import * as ort from "onnxruntime-web";

const DEFAULT_INPUT_SIZE = 640;
const DEFAULT_SCORE_THRESHOLD = 0.35;
const DEFAULT_IOU_THRESHOLD = 0.45;
const DEFAULT_MAX_DETECTIONS = 80;
const DEFAULT_PERSON_CLASS_ID = 0;

interface LetterboxResult {
  inputTensor: ort.Tensor;
  scale: number;
  padX: number;
  padY: number;
}

export interface CrowdDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  classId: number;
  label: string;
}

export interface CrowdDetectOptions {
  scoreThreshold?: number;
  iouThreshold?: number;
  maxDetections?: number;
  personClassId?: number;
}

export interface CrowdDetectResult {
  detections: CrowdDetection[];
  inferenceMs: number;
  frameSize: {
    width: number;
    height: number;
  };
}

interface BoxCandidate {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  classId: number;
}

let ortConfigured = false;

const configureOrtOnce = () => {
  if (ortConfigured) {
    return;
  }

  ort.env.wasm.numThreads = 1;
  ortConfigured = true;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const clip = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const toProbability = (value: number) => {
  if (value >= 0 && value <= 1) {
    return value;
  }

  return sigmoid(value);
};

const iou = (a: BoxCandidate, b: BoxCandidate) => {
  const intersectionX1 = Math.max(a.x1, b.x1);
  const intersectionY1 = Math.max(a.y1, b.y1);
  const intersectionX2 = Math.min(a.x2, b.x2);
  const intersectionY2 = Math.min(a.y2, b.y2);

  const intersectionWidth = Math.max(0, intersectionX2 - intersectionX1);
  const intersectionHeight = Math.max(0, intersectionY2 - intersectionY1);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea <= 0) {
    return 0;
  }

  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const unionArea = areaA + areaB - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
};

const nms = (boxes: BoxCandidate[], iouThreshold: number, maxDetections: number) => {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const selected: BoxCandidate[] = [];

  while (sorted.length > 0 && selected.length < maxDetections) {
    const candidate = sorted.shift();
    if (!candidate) {
      break;
    }

    const overlaps = selected.some((picked) => iou(candidate, picked) > iouThreshold);
    if (!overlaps) {
      selected.push(candidate);
    }
  }

  return selected;
};

const ensureTensor = (value: unknown): value is ort.Tensor =>
  Boolean(value && typeof value === "object" && "dims" in value && "data" in value);

const toBoxCandidates = (
  outputTensor: ort.Tensor,
  personClassId: number,
  scoreThreshold: number,
  iouThreshold: number,
  maxDetections: number,
  scale: number,
  padX: number,
  padY: number,
  frameWidth: number,
  frameHeight: number
) => {
  if (outputTensor.type !== "float32") {
    throw new Error(`Unsupported output tensor type "${outputTensor.type}". Expected float32.`);
  }

  const data = outputTensor.data as Float32Array;
  const dims = outputTensor.dims;

  if (dims.length !== 3 || dims[0] !== 1) {
    throw new Error(`Unexpected output shape [${dims.join(", ")}]. Expected [1, channels, boxes] or [1, boxes, channels].`);
  }

  let channels = dims[1];
  let boxes = dims[2];
  let valueAt: (channel: number, boxIndex: number) => number;

  if (channels <= 128 && boxes > 128) {
    valueAt = (channel, boxIndex) => data[channel * boxes + boxIndex];
  } else if (boxes <= 128 && channels > 128) {
    channels = dims[2];
    boxes = dims[1];
    valueAt = (channel, boxIndex) => data[boxIndex * channels + channel];
  } else {
    throw new Error(`Cannot infer tensor layout from output shape [${dims.join(", ")}].`);
  }

  if (channels < 6) {
    throw new Error(`Output tensor has ${channels} channels; expected at least 6.`);
  }

  const hasObjectnessChannel = channels !== 84;
  const classStartIndex = hasObjectnessChannel ? 5 : 4;
  const classCount = channels - classStartIndex;
  if (classCount <= personClassId) {
    throw new Error(
      `Model output has ${classCount} classes, but person class id ${personClassId} is out of range.`
    );
  }

  const candidates: BoxCandidate[] = [];
  for (let boxIndex = 0; boxIndex < boxes; boxIndex += 1) {
    const cx = valueAt(0, boxIndex);
    const cy = valueAt(1, boxIndex);
    const w = valueAt(2, boxIndex);
    const h = valueAt(3, boxIndex);

    if (![cx, cy, w, h].every(isFiniteNumber) || w <= 0 || h <= 0) {
      continue;
    }

    const classScore = toProbability(valueAt(classStartIndex + personClassId, boxIndex));
    const objectness = hasObjectnessChannel ? toProbability(valueAt(4, boxIndex)) : 1;
    const score = classScore * objectness;

    if (!isFiniteNumber(score) || score < scoreThreshold) {
      continue;
    }

    const x1Input = cx - w / 2;
    const y1Input = cy - h / 2;
    const x2Input = cx + w / 2;
    const y2Input = cy + h / 2;

    const x1 = clip((x1Input - padX) / scale, 0, frameWidth);
    const y1 = clip((y1Input - padY) / scale, 0, frameHeight);
    const x2 = clip((x2Input - padX) / scale, 0, frameWidth);
    const y2 = clip((y2Input - padY) / scale, 0, frameHeight);

    if (x2 - x1 < 2 || y2 - y1 < 2) {
      continue;
    }

    candidates.push({
      x1,
      y1,
      x2,
      y2,
      score,
      classId: personClassId
    });
  }

  const selected = nms(candidates, iouThreshold, maxDetections);
  return selected.map<CrowdDetection>((detection) => ({
    x: detection.x1,
    y: detection.y1,
    width: detection.x2 - detection.x1,
    height: detection.y2 - detection.y1,
    score: detection.score,
    classId: detection.classId,
    label: "person"
  }));
};

export class CrowdDetector {
  private session: ort.InferenceSession | null = null;
  private inputName: string | null = null;
  private outputName: string | null = null;
  private inputSize = DEFAULT_INPUT_SIZE;
  private preprocessingCanvas = document.createElement("canvas");
  private preprocessingContext = this.preprocessingCanvas.getContext("2d", { willReadFrequently: true });

  private async initializeSession(modelSource: string | Uint8Array) {
    if (typeof modelSource === "string") {
      this.session = await ort.InferenceSession.create(modelSource, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all"
      });
    } else {
      this.session = await ort.InferenceSession.create(modelSource, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all"
      });
    }
    this.inputName = this.session.inputNames[0] ?? null;
    this.outputName = this.session.outputNames[0] ?? null;

    if (!this.inputName || !this.outputName) {
      throw new Error("Model does not expose at least one input and one output.");
    }

    const inputMetadata = this.session.inputMetadata[0];
    if (inputMetadata && "shape" in inputMetadata && Array.isArray(inputMetadata.shape)) {
      const modelHeight = inputMetadata.shape[2];
      const modelWidth = inputMetadata.shape[3];
      if (isFiniteNumber(modelHeight) && isFiniteNumber(modelWidth) && modelHeight === modelWidth) {
        this.inputSize = modelHeight;
      }
    }

    this.preprocessingCanvas.width = this.inputSize;
    this.preprocessingCanvas.height = this.inputSize;
  }

  async loadModel(modelUrl: string) {
    configureOrtOnce();
    await this.release();
    await this.initializeSession(modelUrl);
  }

  async loadModelFromBuffer(modelBuffer: ArrayBuffer) {
    configureOrtOnce();
    await this.release();
    await this.initializeSession(new Uint8Array(modelBuffer));
  }

  isLoaded() {
    return this.session !== null;
  }

  private frameToInputTensor(video: HTMLVideoElement): LetterboxResult {
    if (!this.preprocessingContext) {
      throw new Error("Cannot create preprocessing canvas context.");
    }

    const frameWidth = video.videoWidth;
    const frameHeight = video.videoHeight;
    if (frameWidth <= 0 || frameHeight <= 0) {
      throw new Error("Video frame not ready.");
    }

    const target = this.inputSize;
    const scale = Math.min(target / frameWidth, target / frameHeight);
    const drawWidth = Math.round(frameWidth * scale);
    const drawHeight = Math.round(frameHeight * scale);
    const padX = Math.floor((target - drawWidth) / 2);
    const padY = Math.floor((target - drawHeight) / 2);

    const ctx = this.preprocessingContext;
    ctx.clearRect(0, 0, target, target);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, target, target);
    ctx.drawImage(video, 0, 0, frameWidth, frameHeight, padX, padY, drawWidth, drawHeight);

    const imageData = ctx.getImageData(0, 0, target, target);
    const pixels = imageData.data;

    const tensorData = new Float32Array(3 * target * target);
    const channelSize = target * target;
    for (let i = 0; i < channelSize; i += 1) {
      const px = i * 4;
      tensorData[i] = pixels[px] / 255;
      tensorData[channelSize + i] = pixels[px + 1] / 255;
      tensorData[channelSize * 2 + i] = pixels[px + 2] / 255;
    }

    const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, target, target]);
    return { inputTensor, scale, padX, padY };
  }

  async detect(video: HTMLVideoElement, options: CrowdDetectOptions = {}): Promise<CrowdDetectResult> {
    if (!this.session || !this.inputName || !this.outputName) {
      throw new Error("Model is not loaded.");
    }

    const frameWidth = video.videoWidth;
    const frameHeight = video.videoHeight;
    if (frameWidth <= 0 || frameHeight <= 0) {
      throw new Error("Video stream is not ready.");
    }

    const { inputTensor, scale, padX, padY } = this.frameToInputTensor(video);

    const start = performance.now();
    const outputs = await this.session.run({
      [this.inputName]: inputTensor
    });
    const end = performance.now();

    const outputValue = outputs[this.outputName] ?? Object.values(outputs)[0];
    if (!ensureTensor(outputValue)) {
      throw new Error("Model output is not a tensor.");
    }

    const detections = toBoxCandidates(
      outputValue,
      options.personClassId ?? DEFAULT_PERSON_CLASS_ID,
      options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD,
      options.iouThreshold ?? DEFAULT_IOU_THRESHOLD,
      options.maxDetections ?? DEFAULT_MAX_DETECTIONS,
      scale,
      padX,
      padY,
      frameWidth,
      frameHeight
    );

    return {
      detections,
      inferenceMs: end - start,
      frameSize: {
        width: frameWidth,
        height: frameHeight
      }
    };
  }

  async release() {
    if (this.session) {
      await this.session.release();
      this.session = null;
      this.inputName = null;
      this.outputName = null;
    }
  }
}
