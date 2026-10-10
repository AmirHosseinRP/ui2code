import type { Detector, DetectorContext, DetectorResult } from "./registry";
import type { ComponentLib } from "../schemas/stack";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let value: ComponentLib = "none";

  if (!ctx.packageJson) {
    return { componentLib: { value: "none", confidence: 0.5, evidence: [] } };
  }

  const deps = {
    ...(ctx.packageJson.dependencies as Record<string, string> | undefined),
    ...(ctx.packageJson.devDependencies as Record<string, string> | undefined),
  };

  if (!deps) {
    return { componentLib: { value: "none", confidence: 0.5, evidence: [] } };
  }

  // shadcn/ui — detected by @shadcn/ui package or components/ui directory
  if (deps["@shadcn/ui"] || (await ctx.fileExists("components/ui/button.tsx")) || (await ctx.fileExists("src/components/ui/button.tsx"))) {
    value = "shadcn";
    evidence.push({ file: "package.json", match: "@shadcn/ui" });
  }
  // MUI
  else if (deps["@mui/material"] || deps["@mui/system"]) {
    value = "mui";
    evidence.push({ file: "package.json", match: "@mui/material" });
  }
  // Chakra UI
  else if (deps["@chakra-ui/react"] || deps["@chakra-ui/next-js"]) {
    value = "chakra";
    evidence.push({ file: "package.json", match: "@chakra-ui/react" });
  }
  // Ant Design
  else if (deps.antd || deps["@ant-design/icons"]) {
    value = "ant";
    evidence.push({ file: "package.json", match: "antd" });
  }
  // Mantine
  else if (deps["@mantine/core"] || deps["@mantine/hooks"]) {
    value = "mantine";
    evidence.push({ file: "package.json", match: "@mantine/core" });
  }
  // Radix UI (standalone, not via shadcn)
  else if (deps["@radix-ui/react-dialog"] || deps["@radix-ui/react-dropdown-menu"] || deps["@radix-ui/themes"]) {
    value = "radix";
    evidence.push({ file: "package.json", match: "@radix-ui" });
  }

  // Icon library detection
  let iconLib = "none";
  if (deps["lucide-react"] || deps["lucide"]) {
    iconLib = "lucide";
    evidence.push({ file: "package.json", match: "lucide-react" });
  } else if (deps["react-icons"]) {
    iconLib = "react-icons";
    evidence.push({ file: "package.json", match: "react-icons" });
  } else if (deps["@heroicons/react"]) {
    iconLib = "heroicons";
    evidence.push({ file: "package.json", match: "@heroicons/react" });
  } else if (deps["@phosphor-icons/react"]) {
    iconLib = "phosphor";
    evidence.push({ file: "package.json", match: "@phosphor-icons/react" });
  } else if (deps["react-feather"]) {
    iconLib = "feather";
    evidence.push({ file: "package.json", match: "react-feather" });
  }

  // Animation library detection
  let animationLib = "none";
  if (deps["framer-motion"]) {
    animationLib = "framer-motion";
    evidence.push({ file: "package.json", match: "framer-motion" });
  } else if (deps["@react-spring/web"] || deps["react-spring"]) {
    animationLib = "react-spring";
    evidence.push({ file: "package.json", match: "react-spring" });
  } else if (deps["motion"]) {
    animationLib = "motion";
    evidence.push({ file: "package.json", match: "motion" });
  } else if (deps["gsap"]) {
    animationLib = "gsap";
    evidence.push({ file: "package.json", match: "gsap" });
  }

  return {
    componentLib: { value, confidence: evidence.length > 0 ? 0.9 : 0.5, evidence },
    iconLib: { value: iconLib, confidence: iconLib !== "none" ? 0.9 : 0.5, evidence },
    animationLib: { value: animationLib, confidence: animationLib !== "none" ? 0.9 : 0.5, evidence },
  };
}

export const componentLibDetector: Detector = {
  name: "component-lib",
  detect,
};