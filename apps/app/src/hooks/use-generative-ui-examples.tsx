"use client";

import { z } from "zod";
import { useTheme } from "@/hooks/use-theme";
import {
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { ToolReasoning } from "@/components/tool-rendering";

export const useGenerativeUIExamples = () => {
  const { theme, setTheme } = useTheme();

  const ignoredTools = ["generate_form", "log_a2ui_event"];
  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (ignoredTools.includes(name)) return <></>;
      return <ToolReasoning name={name} status={status} args={parameters} />;
    },
  });

  useFrontendTool(
    {
      name: "toggleTheme",
      description: "Frontend tool for toggling the theme of the app.",
      parameters: z.object({}),
      handler: async () => {
        setTheme(theme === "dark" ? "light" : "dark");
      },
    },
    [theme, setTheme],
  );
};
