import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, Play, Square, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CrowdDetection, CrowdDetector } from "../services/crowdDetection";

const DEFAULT_MODEL_URL = "/models/crowd-detection.onnx";

type ModelStatus = "idle" | "loading" | "ready" | "error";
type CameraStatus = "idle" | "requesting" | "ready" | "error";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown error.";
};

export const CrowdPage = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<CrowdDetector | null>(null);
  const animationRef = useRef<number | null>(null);
  const inferenceInFlightRef = useRef(false);
  const loopActiveRef = useRef(false);

  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL_URL);
  const [modelFileName, setModelFileName] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [detections, setDetections] = useState<CrowdDetection[]>([]);
  const [personCount, setPersonCount] = useState(0);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);

  const clearOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawDetections = useCallback((boxes: CrowdDetection[], frameWidth: number, frameHeight: number) => {
    const canvas = overlayRef.current;
    if (!canvas) {
      return;
    }

    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, frameWidth, frameHeight);
    context.lineWidth = 2;
    context.strokeStyle = "#22c55e";
    context.font = "13px Manrope, sans-serif";
    context.textBaseline = "top";

    boxes.forEach((box) => {
      context.strokeRect(box.x, box.y, box.width, box.height);

      const tag = `${box.label} ${(box.score * 100).toFixed(0)}%`;
      const textWidth = context.measureText(tag).width;
      const textX = box.x;
      const textY = Math.max(0, box.y - 18);

      context.fillStyle = "#22c55e";
      context.fillRect(textX, textY, textWidth + 10, 18);
      context.fillStyle = "#06230f";
      context.fillText(tag, textX + 5, textY + 3);
    });
  }, []);

  const stopDetectionLoop = useCallback(() => {
    loopActiveRef.current = false;
    inferenceInFlightRef.current = false;
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    setIsRunning(false);
    setCameraStatus("idle");
    setCameraError(null);
    setAnalysisError(null);
    setDetections([]);
    setPersonCount(0);
    setInferenceMs(null);
    setLastAnalyzedAt(null);
    clearOverlay();
  }, [clearOverlay, stopDetectionLoop]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraError("This browser does not support webcam access.");
      return false;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      setCameraStatus("error");
      setCameraError("Video element is not available.");
      return false;
    }

    setCameraStatus("requesting");
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      setCameraStatus("ready");
      return true;
    } catch (error) {
      setCameraStatus("error");
      setCameraError(getErrorMessage(error));
      return false;
    }
  }, []);

  const loadModel = useCallback(async () => {
    const trimmedModelUrl = modelUrl.trim();
    if (!trimmedModelUrl) {
      setModelStatus("error");
      setModelError("Model URL is required.");
      return false;
    }

    setModelStatus("loading");
    setModelError(null);
    setAnalysisError(null);

    try {
      const nextDetector = new CrowdDetector();
      await nextDetector.loadModel(trimmedModelUrl);

      if (detectorRef.current) {
        await detectorRef.current.release();
      }

      detectorRef.current = nextDetector;
      setModelFileName(null);
      setModelStatus("ready");
      return true;
    } catch (error) {
      setModelStatus("error");
      setModelError(getErrorMessage(error));
      return false;
    }
  }, [modelUrl]);

  const loadModelFile = useCallback(async (file: File | null) => {
    if (!file) {
      return false;
    }

    setModelStatus("loading");
    setModelError(null);
    setAnalysisError(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      const nextDetector = new CrowdDetector();
      await nextDetector.loadModelFromBuffer(fileBuffer);

      if (detectorRef.current) {
        await detectorRef.current.release();
      }

      detectorRef.current = nextDetector;
      setModelFileName(file.name);
      setModelStatus("ready");
      return true;
    } catch (error) {
      setModelStatus("error");
      setModelError(getErrorMessage(error));
      return false;
    }
  }, []);

  const runOneInference = useCallback(async () => {
    const detector = detectorRef.current;
    const videoElement = videoRef.current;
    if (!detector || !videoElement) {
      return;
    }

    if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const result = await detector.detect(videoElement, {
      scoreThreshold: 0.35,
      iouThreshold: 0.45,
      maxDetections: 120,
      personClassId: 0
    });

    setDetections(result.detections);
    setPersonCount(result.detections.length);
    setInferenceMs(result.inferenceMs);
    setLastAnalyzedAt(Date.now());
    drawDetections(result.detections, result.frameSize.width, result.frameSize.height);
  }, [drawDetections]);

  const startAnalysis = useCallback(async () => {
    setAnalysisError(null);

    let modelReady = detectorRef.current?.isLoaded() ?? false;
    if (!modelReady) {
      modelReady = await loadModel();
    }
    if (!modelReady) {
      return;
    }

    let cameraReady = cameraStatus === "ready";
    if (!cameraReady) {
      cameraReady = await startCamera();
    }
    if (!cameraReady) {
      return;
    }

    setIsRunning(true);
  }, [cameraStatus, loadModel, startCamera]);

  const stopAnalysis = useCallback(() => {
    setIsRunning(false);
    stopDetectionLoop();
  }, [stopDetectionLoop]);

  useEffect(() => {
    if (!isRunning) {
      stopDetectionLoop();
      return;
    }

    loopActiveRef.current = true;
    const frameStep = () => {
      if (!loopActiveRef.current) {
        return;
      }

      if (!inferenceInFlightRef.current) {
        inferenceInFlightRef.current = true;
        void runOneInference()
          .catch((error) => {
            setAnalysisError(getErrorMessage(error));
            setIsRunning(false);
          })
          .finally(() => {
            inferenceInFlightRef.current = false;
          });
      }

      animationRef.current = window.requestAnimationFrame(frameStep);
    };

    animationRef.current = window.requestAnimationFrame(frameStep);
    return () => stopDetectionLoop();
  }, [isRunning, runOneInference, stopDetectionLoop]);

  useEffect(
    () => () => {
      stopDetectionLoop();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }

      const detector = detectorRef.current;
      if (detector) {
        void detector.release();
      }
    },
    [stopDetectionLoop]
  );

  const modelStatusLabel = useMemo(() => {
    if (modelStatus === "ready") {
      return "Loaded";
    }
    if (modelStatus === "loading") {
      return "Loading";
    }
    if (modelStatus === "error") {
      return "Error";
    }
    return "Not loaded";
  }, [modelStatus]);

  const pipelineStatusLabel = isRunning ? "Running" : cameraStatus === "ready" ? "Camera ready" : "Stopped";

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Crowd Vision</p>
            <h2 className="mt-2 text-3xl text-brand-navy">Crowd Detection (ONNX + Webcam)</h2>
            <p className="section-copy mt-2">
              Runs ONNX inference directly on your Mac webcam frames and overlays person detections in real time.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="h-4 w-4" />
            <span>{pipelineStatusLabel}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="stat-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">People detected</p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">{personCount}</p>
          </div>
          <div className="stat-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Inference latency</p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">
              {inferenceMs ? `${inferenceMs.toFixed(1)} ms` : "--"}
            </p>
          </div>
          <div className="stat-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Model</p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">{modelStatusLabel}</p>
          </div>
          <div className="stat-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last analyzed</p>
            <p className="mt-1 text-base font-semibold text-brand-navy">
              {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString() : "--"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="eyebrow">Model Setup</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={modelUrl}
            onChange={(event) => setModelUrl(event.target.value)}
            className="app-input"
            placeholder="/models/crowd-detection.onnx"
            aria-label="ONNX model URL"
          />
          <Button onClick={() => void loadModel()} disabled={modelStatus === "loading"}>
            {modelStatus === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Load ONNX Model"
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[18px] border border-brand-navy/10 bg-brand-cream px-4 py-3 text-sm font-extrabold text-brand-navy hover:bg-white">
            <input
              type="file"
              accept=".onnx"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                void loadModelFile(nextFile);
                event.currentTarget.value = "";
              }}
            />
            Upload ONNX File
          </label>
          <span className="text-xs text-slate-500">{modelFileName ? `Loaded: ${modelFileName}` : "No local file loaded."}</span>
        </div>
        <p className="text-xs text-slate-500">
          Put your model in <code>public/models/crowd-detection.onnx</code> or provide another URL with CORS enabled.
        </p>
        {modelError && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {modelError}
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning ? (
            <Button onClick={() => void startAnalysis()} disabled={modelStatus === "loading" || cameraStatus === "requesting"}>
              <Play className="mr-2 h-4 w-4" />
              Start Real-Time Analysis
            </Button>
          ) : (
            <Button onClick={stopAnalysis} variant="secondary">
              <Square className="mr-2 h-4 w-4" />
              Stop Analysis
            </Button>
          )}
          <Button onClick={stopCamera} variant="ghost" disabled={cameraStatus === "idle" && !isRunning}>
            <Camera className="mr-2 h-4 w-4" />
            Release Camera
          </Button>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-border bg-slate-900" style={{ aspectRatio: "16 / 9" }}>
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          {cameraStatus !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/85 text-slate-100">
              {cameraStatus === "requesting" && <Loader2 className="h-5 w-5 animate-spin" />}
              <p className="text-sm">{cameraStatus === "requesting" ? "Requesting camera access..." : "Camera is not active."}</p>
            </div>
          )}
        </div>

        {cameraError && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {cameraError}
          </p>
        )}
        {analysisError && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {analysisError}
          </p>
        )}
      </Card>

      <Card>
        <p className="eyebrow">Top Detections</p>
        {detections.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No people detected in the current frame.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="app-table min-w-[500px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Confidence</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Width</th>
                  <th>Height</th>
                </tr>
              </thead>
              <tbody>
                {detections.slice(0, 10).map((detection, index) => (
                  <tr key={`${detection.x}-${detection.y}-${detection.score}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{(detection.score * 100).toFixed(1)}%</td>
                    <td>{detection.x.toFixed(0)}</td>
                    <td>{detection.y.toFixed(0)}</td>
                    <td>{detection.width.toFixed(0)}</td>
                    <td>{detection.height.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
