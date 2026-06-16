import { useState } from "react";
import { useListTerms, getListTermsQueryKey, useCreateTerm, useUpdateTerm, useDeleteTerm, TermStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const termSchema = z.object({
  term: z.string().min(1, "Обязательное поле"),
  description: z.string().min(1, "Обязательное поле"),
  status: z.enum([TermStatus.actual, TermStatus.moderation, TermStatus.deprecated]),
});

export default function Dictionary() {
  const queryClient = useQueryClient();
  const { data: terms } = useListTerms({ all: "1" }, { query: { queryKey: getListTermsQueryKey({ all: "1" }) } });
  
  const createTermMutation = useCreateTerm();
  const updateTermMutation = useUpdateTerm();
  const deleteTermMutation = useDeleteTerm();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTermId, setEditTermId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof termSchema>>({
    resolver: zodResolver(termSchema),
    defaultValues: { term: "", description: "", status: TermStatus.actual },
  });

  const onCreateSubmit = (values: z.infer<typeof termSchema>) => {
    createTermMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTermsQueryKey({ all: "1" }) });
        setCreateOpen(false);
        form.reset();
        toast({ title: "Успех", description: "Термин добавлен" });
      }
    });
  };

  const onEditSubmit = (values: z.infer<typeof termSchema>) => {
    if (!editTermId) return;
    updateTermMutation.mutate({ id: editTermId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTermsQueryKey({ all: "1" }) });
        setEditTermId(null);
        toast({ title: "Успех", description: "Термин обновлён" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Удалить термин?")) {
      deleteTermMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTermsQueryKey({ all: "1" }) });
          toast({ title: "Успех", description: "Термин удалён" });
        }
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "actual": return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Актуальный</span>;
      case "moderation": return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">На модерации</span>;
      case "deprecated": return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Устарел</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Словарь</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-term">Добавить термин</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый термин</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={form.control} name="term" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Термин (англ.)</FormLabel>
                    <FormControl><Input {...field} data-testid="input-term-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание (рус.)</FormLabel>
                    <FormControl><Textarea {...field} data-testid="input-term-desc" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-term-status">
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="actual">Актуальный</SelectItem>
                        <SelectItem value="moderation">На модерации</SelectItem>
                        <SelectItem value="deprecated">Устарел</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={createTermMutation.isPending} data-testid="button-submit-create">Добавить</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Термин</TableHead>
                <TableHead className="w-[50%]">Описание</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms?.map((term) => (
                <TableRow key={term.id} data-testid={`row-term-${term.id}`}>
                  <TableCell className="font-mono font-medium">{term.term}</TableCell>
                  <TableCell className="text-muted-foreground">{term.description}</TableCell>
                  <TableCell>{getStatusBadge(term.status)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog open={editTermId === term.id} onOpenChange={(open) => {
                      if (open) {
                        setEditTermId(term.id);
                        form.reset({ term: term.term, description: term.description, status: term.status as any });
                      } else {
                        setEditTermId(null);
                        form.reset();
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`button-edit-${term.id}`}>Изменить</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Редактировать термин</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                            <FormField control={form.control} name="term" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Термин (англ.)</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Описание (рус.)</FormLabel>
                                <FormControl><Textarea {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Статус</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Выберите статус" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="actual">Актуальный</SelectItem>
                                    <SelectItem value="moderation">На модерации</SelectItem>
                                    <SelectItem value="deprecated">Устарел</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" disabled={updateTermMutation.isPending}>Сохранить</Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(term.id)} data-testid={`button-delete-${term.id}`}>Удалить</Button>
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
