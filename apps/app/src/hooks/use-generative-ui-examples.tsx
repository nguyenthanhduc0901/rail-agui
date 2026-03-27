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
      description:
        "Chuyển đổi nhanh giữa giao diện sáng và tối của ứng dụng.",
      parameters: z.object({}),
      handler: async () => {
        setTheme(theme === "dark" ? "light" : "dark");
      },
    },
    [theme, setTheme],
  );

  useFrontendTool(
    {
      name: "setTheme",
      description:
        "Đặt chế độ giao diện chính xác theo yêu cầu người dùng: light, dark hoặc system.",
      parameters: z.object({
        mode: z.enum(["light", "dark", "system"]),
      }),
      handler: async ({ mode }) => {
        setTheme(mode);
      },
    },
    [setTheme],
  );
};
