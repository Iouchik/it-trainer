import { useState } from "react";
import { useGetMyStats, getGetMyStatsQueryKey, useGetMyChartData, getGetMyChartDataQueryKey, useGetMyRoundHistory, getGetMyRoundHistoryQueryKey, useSubmitFeedback } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const feedbackSchema = z.object({
  message: z.string().min(1, "Обязательное поле"),
});

export default function Stats() {
  const { data: stats } = useGetMyStats({ query: { queryKey: getGetMyStatsQueryKey() } });
  const { data: chartData } = useGetMyChartData({ query: { queryKey: getGetMyChartDataQueryKey() } });
  const { data: history } = useGetMyRoundHistory({ query: { queryKey: getGetMyRoundHistoryQueryKey() } });
  const [feedbackTermId, setFeedbackTermId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const submitFeedbackMutation = useSubmitFeedback();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { message: "" },
  });

  const onFeedbackSubmit = (values: z.infer<typeof feedbackSchema>) => {
    if (!feedbackTermId) return;
    submitFeedbackMutation.mutate({ data: { termId: feedbackTermId, message: values.message } }, {
      onSuccess: () => {
        toast({ title: "Отзыв отправлен", description: "Спасибо за ваш отзыв!" });
        setDialogOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Ошибка", description: "Не удалось отправить отзыв" });
      }
    });
  };

  const formattedChartData = chartData?.labels.map((label, i) => ({
    name: label,
    value: chartData.values[i]
  })) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-bottom-4 duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Моя статистика</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего раундов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-rounds">{stats?.totalRounds || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Успешных</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-success-percent">
              {stats?.successRounds || 0} ({stats?.successPercent || 0}%)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Использовано подсказок</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-hints-used">{stats?.hintsUsed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">В среднем попыток</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-attempts">{stats?.avgAttempts?.toFixed(1) || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Активность за 7 дней</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последние раунды</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Термин</TableHead>
                <TableHead>Результат</TableHead>
                <TableHead>Попыток</TableHead>
                <TableHead>Подсказка</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((item) => (
                <TableRow key={item.id} data-testid={`row-history-${item.id}`}>
                  <TableCell>{format(new Date(item.playedAt), "dd.MM.yyyy HH:mm")}</TableCell>
                  <TableCell className="font-mono">{item.term}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.success ? "Успех" : "Провал"}
                    </span>
                  </TableCell>
                  <TableCell>{item.attempts}</TableCell>
                  <TableCell>{item.hintUsed ? "Да" : "Нет"}</TableCell>
                  <TableCell>
                    {item.termId && (
                      <Dialog open={dialogOpen && feedbackTermId === item.termId} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (open) setFeedbackTermId(item.termId!);
                        else setFeedbackTermId(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-feedback-${item.id}`}>Отзыв</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Отзыв по термину "{item.term}"</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onFeedbackSubmit)} className="space-y-4">
                              <FormField control={form.control} name="message" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Сообщение</FormLabel>
                                  <FormControl><Input placeholder="Что не так с этим термином?" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <Button type="submit" disabled={submitFeedbackMutation.isPending}>Отправить</Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
