import { useGetLogs, getGetLogsQueryKey, useClearLogs } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function Logs() {
  const queryClient = useQueryClient();
  const { data: logs, isFetching } = useGetLogs({ query: { queryKey: getGetLogsQueryKey() } });
  const clearLogsMutation = useClearLogs();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
  };

  const handleClear = () => {
    if (confirm("Очистить все логи?")) {
      clearLogsMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
        }
      });
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info": return "text-blue-400";
      case "warn": return "text-yellow-400";
      case "error": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Системные логи</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching} data-testid="button-refresh-logs">Обновить</Button>
          <Button variant="destructive" onClick={handleClear} disabled={clearLogsMutation.isPending} data-testid="button-clear-logs">Очистить</Button>
        </div>
      </div>

      <Card className="bg-slate-950 border-slate-800">
        <CardContent className="p-4 font-mono text-sm h-[600px] overflow-auto">
          {logs?.map((log) => (
            <div key={log.id} className="flex gap-4 py-1 hover:bg-slate-900 px-2 rounded" data-testid={`log-entry-${log.id}`}>
              <span className="text-slate-500 shrink-0">[{format(new Date(log.createdAt), "HH:mm:ss")}]</span>
              <span className={`font-bold shrink-0 w-16 ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</span>
              <span className="text-slate-300 break-words">{log.message}</span>
            </div>
          ))}
          {(!logs || logs.length === 0) && (
            <div className="text-slate-500 italic p-4 text-center">Логов нет</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
