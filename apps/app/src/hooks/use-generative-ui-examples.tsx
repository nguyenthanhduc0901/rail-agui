"use client";

import { z } from "zod";
import { useTheme } from "@/hooks/use-theme";
import {
  useComponent,
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { ToolReasoning } from "@/components/tool-rendering";

const newIssueCardSchema = z.object({
  trainId: z.string().describe("ID của tàu, ví dụ: TR-001"),
  carriageId: z.string().describe("ID toa tàu, ví dụ: C-03"),
  system: z.string().describe("Hệ thống gặp sự cố, ví dụ: Brakes"),
  priority: z
    .enum(["critical", "high", "medium", "low"])
    .describe("Mức độ ưu tiên của sự cố"),
  description: z
    .string()
    .describe("Mô tả sự cố đã được chỉnh sửa rõ ràng và chính xác"),
});

function NewIssueCard({
  trainId,
  carriageId,
  system,
  priority,
  description,
}: z.infer<typeof newIssueCardSchema>) {
  const priorityStyle = {
    critical:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40",
    high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/40",
    medium:
      "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-900/40",
    low: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40",
  } as const;

  return (
    <div className="my-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          New Issue
        </h4>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${priorityStyle[priority]}`}
        >
          {priority}
        </span>
      </div>

      <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        <p>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">Train:</span>{" "}
          {trainId}
        </p>
        <p>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">Carriage:</span>{" "}
          {carriageId}
        </p>
        <p>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">System:</span>{" "}
          {system}
        </p>
      </div>

      <p className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
        {description}
      </p>
    </div>
  );
}

export const useGenerativeUIExamples = () => {
  const { theme, setTheme } = useTheme();

  const ignoredTools = ["generate_form", "log_a2ui_event"];
  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (ignoredTools.includes(name)) return <></>;
      return <ToolReasoning name={name} status={status} args={parameters} />;
    },
  });

  useComponent({
    name: "displayNewIssueCard",
    description:
      "Hiển thị thẻ New Issue trong chatbot panel. Trước khi gọi tool này, agent PHẢI chỉnh sửa mô tả sự cố của người dùng cho rõ ràng, đúng thuật ngữ, và ngắn gọn.",
    parameters: newIssueCardSchema,
    render: NewIssueCard,
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
