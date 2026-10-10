export { detectStack, type DetectStackOptions } from "./detect-stack";
export { scanConventions, type ScanConventionsOptions } from "./conventions";
export { readImage, readImages, isValidImageFile, toDataUrl, type ImageInfo } from "./screenshot";
export { callVisionModel, type VisionModelRequest, type VisionModelResponse } from "./screenshot";
export { analyzeScreenshot, type AnalyzeScreenshotOptions } from "./screenshot";
export { mapToDesignSystem, type MapToDesignSystemOptions, type DesignSystemMapping, type MappedComponent } from "./mapper";
export { writeComponentFiles, formatWriteResult, type FileToWrite, type WriteResult } from "./writer";
export { verifyProject, formatVerifyResult, type VerifyResult, type ScriptError } from "./verification";
export {
  resolveModelConfig,
  getVisionModel,
  modelLikelySupportsVision,
  findApiKey,
  readUi2codeConfig,
  readEnvFile,
  readAuthStore,
  type ModelConfig,
  type KeySource,
  type Ui2codeConfig,
  type Ui2codeProjectOverrides,
} from "./config";
export * from "./schemas";
export { applyStackOverrides, type StackOverrides } from "./detectors/overrides";
export { type Detector, type DetectorContext, registerDetector, getDetectors, clearDetectors } from "./detectors/registry";
export { registerBuiltinDetectors } from "./detectors";