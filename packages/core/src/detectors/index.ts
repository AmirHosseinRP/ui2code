export { packageManagerDetector } from "./package-manager";
export { languageDetector } from "./language";
export { frameworkDetector } from "./framework";
export { stylingDetector } from "./styling";
export { componentLibDetector } from "./component-lib";
export { testSetupDetector } from "./test-setup";
export { monorepoDetector } from "./monorepo";

import { packageManagerDetector } from "./package-manager";
import { languageDetector } from "./language";
import { frameworkDetector } from "./framework";
import { stylingDetector } from "./styling";
import { componentLibDetector } from "./component-lib";
import { testSetupDetector } from "./test-setup";
import { monorepoDetector } from "./monorepo";
import { registerDetector } from "./registry";

/** Register all built-in detectors in default order */
export function registerBuiltinDetectors(): void {
  registerDetector(packageManagerDetector);
  registerDetector(languageDetector);
  registerDetector(frameworkDetector);
  registerDetector(stylingDetector);
  registerDetector(componentLibDetector);
  registerDetector(testSetupDetector);
  registerDetector(monorepoDetector);
}