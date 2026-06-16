import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  useGetMyStats, getGetMyStatsQueryKey,
  useGetCurrentRound, getGetCurrentRoundQueryKey,
  useStartRound, useSubmitAnswer, useRequestHint, useForfeitRound
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";

const answerSchema = z.object({
  answer: z.string().min(1, "Введите термин"),
});

export default function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: stats } = useGetMyStats({ query: { queryKey: getGetMyStatsQueryKey() } });
  const { data: currentRound, isLoading: isRoundLoading } = useGetCurrentRound({ 
    query: { queryKey: getGetCurrentRoundQueryKey(), retry: false } 
  });

  const startRoundMutation = useStartRound();
  const submitAnswerMutation = useSubmitAnswer();
  const requestHintMutation = useRequestHint();
  const forfeitRoundMutation = useForfeitRound();

  const [result, setResult] = useState<{ success: boolean; term: string; desc: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: { answer: "" },
  });

  // Handle returning from result screen
  const handleNextRound = () => {
    setResult(null);
    form.reset();
    startRoundMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
      }
    });
  };

  const handleStartRound = () => {
    startRoundMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
      }
    });
  };

  const onSubmitAnswer = (values: z.infer<typeof answerSchema>) => {
    setErrorMsg("");
    submitAnswerMutation.mutate({ data: { answer: values.answer } }, {
      onSuccess: (res) => {
        if (res.finished) {
          setResult({
            success: res.success,
            term: res.correctTerm || values.answer,
            desc: res.description || currentRound?.description || ""
          });
          queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
        } else {
          setErrorMsg(`Неверно. Осталось попыток: ${res.attemptsLeft}`);
          queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
          form.reset();
        }
      }
    });
  };

  const handleHint = () => {
    requestHintMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
      }
    });
  };

  const handleForfeit = () => {
    forfeitRoundMutation.mutate(undefined, {
      onSuccess: (res) => {
        setResult({
          success: res.success,
          term: res.correctTerm,
          desc: res.description
        });
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentRoundQueryKey() });
      }
    });
  };

  if (!user) return null; // handled by layout/routing

  // State 3: Result
  if (result) {
    return (
      <div className="max-w-2xl mx-auto pt-12 animate-in slide-in-from-bottom-4 duration-500">
        <Card className={`border-2 ${result.success ? 'border-green-500' : 'border-red-500'}`}>
          <CardHeader className="text-center">
            <CardTitle className={`text-4xl ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? "Верно!" : "Раунд проигран"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Термин:</p>
              <p className="text-3xl font-mono font-bold">{result.term}</p>
            </div>
            <div className="bg-muted p-6 rounded-lg">
              <p className="text-lg leading-relaxed">{result.desc}</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center pb-8">
            <Button size="lg" onClick={handleNextRound} data-testid="button-next-round">Следующий раунд</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // State 2: Active Round
  if (currentRound && currentRound.roundId !== 0 && !result) {
    return (
      <div className="max-w-3xl mx-auto pt-8 animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-muted-foreground">
            Попытка {currentRound.attemptsTotal - currentRound.attemptsLeft + 1} из {currentRound.attemptsTotal}
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={handleHint} disabled={!currentRound.hintAvailable || requestHintMutation.isPending} data-testid="button-hint">
              Подсказка
            </Button>
            <Button variant="destructive" size="sm" onClick={handleForfeit} disabled={forfeitRoundMutation.isPending} data-testid="button-forfeit">
              Сдаться
            </Button>
          </div>
        </div>

        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl leading-relaxed font-normal">
              {currentRound.description}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentRound.hint && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-amber-900">
                <span className="font-bold mr-2">Подсказка:</span>
                <span className="font-mono tracking-widest">{currentRound.hint}</span>
              </div>
            )}
            
            {errorMsg && (
              <div className="text-red-500 text-sm font-medium animate-in slide-in-from-top-1" data-testid="text-error-msg">
                {errorMsg}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitAnswer)} className="flex gap-4">
                <FormField control={form.control} name="answer" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input 
                        placeholder="Введите термин на английском..." 
                        className="text-lg font-mono px-4 h-14" 
                        autoFocus 
                        autoComplete="off"
                        data-testid="input-answer"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <Button type="submit" size="lg" className="h-14 px-8" disabled={submitAnswerMutation.isPending} data-testid="button-submit-answer">
                  Проверить
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 1: Start Screen
  return (
    <div className="max-w-4xl mx-auto pt-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Добро пожаловать, <span className="text-primary">{user.username}</span>!</h1>
        <p className="text-xl text-muted-foreground">Тренажёр IT-терминологии готов к работе.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader>
            <CardTitle>Ваш прогресс</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold mb-2">{stats?.successPercent || 0}%</div>
            <p className="text-primary-foreground/80">Успешных ответов</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Опыт</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-primary mb-2">{stats?.totalRounds || 0}</div>
            <p className="text-muted-foreground">Пройдено раундов</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" className="h-16 px-12 text-xl shadow-xl hover:scale-105 transition-transform" onClick={handleStartRound} disabled={startRoundMutation.isPending} data-testid="button-start-round">
          Начать новый раунд
        </Button>
      </div>
    </div>
  );
}
