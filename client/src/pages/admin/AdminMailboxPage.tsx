import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Search,
  MailPlus,
  Reply,
  Eye,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { useLanguage } from "@/hooks/use-language";
import { de, hr, it, sl, enUS } from "date-fns/locale";

interface Email {
  id: number;
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  read: boolean;
  type: "inbound" | "outbound";
  inReplyToMessageId?: number | null;
}

interface Conversation {
  id: string;
  latestMessageId: number;
  subject: string;
  messages: Email[];
  unreadCount: number;
  lastActivity: string;
  participants: string[];
}

const sendEmailSchema = z.object({
  recipient: z
    .string()
    .email({ message: "Ungültige E-Mail-Adresse des Empfängers" }),
  subject: z.string().min(1, { message: "Betreff ist erforderlich" }),
  body: z.string().min(1, { message: "Nachricht ist erforderlich" }),
  inReplyToMessageId: z.number().nullable().optional(),
});

type SendEmailFormValues = z.infer<typeof sendEmailSchema>;

export default function AdminMailboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);

  const sendForm = useForm<SendEmailFormValues>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: {
      recipient: "",
      subject: "",
      body: "",
      inReplyToMessageId: null,
    },
  });

  const {
    data: emails,
    isLoading,
    error,
  } = useQuery<Email[]>({
    queryKey: ["/api/admin/emails"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/emails");
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der E-Mails.");
      }
      return await response.json();
    },
  });

  const conversations = useMemo(() => {
    if (!emails) return [];

    const conversationMap = new Map<string, Conversation>();

    const cleanSubject = (subject: string): string => {
      return subject.replace(/^(re|aw|fw|fwd):\s*/i, "").trim();
    };

    const getConversationKey = (email: Email): string => {
      const cleanedSubject = cleanSubject(email.subject);
      const participants = [email.senderEmail, email.recipientEmail]
        .sort()
        .join("-");
      return `${cleanedSubject}-${participants}`;
    };

    const sortedEmails = [...emails].sort(
      (a, b) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    );

    sortedEmails.forEach((email) => {
      const key = getConversationKey(email);

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          latestMessageId: email.id,
          subject: cleanSubject(email.subject),
          messages: [],
          unreadCount: 0,
          lastActivity: email.receivedAt,
          participants: [],
        });
      }

      const conversation = conversationMap.get(key)!;
      conversation.messages.push(email);
      if (!email.read) {
        conversation.unreadCount++;
      }
      if (
        new Date(email.receivedAt).getTime() >
        new Date(conversation.lastActivity).getTime()
      ) {
        conversation.latestMessageId = email.id;
        conversation.lastActivity = email.receivedAt;
      }

      if (!conversation.participants.includes(email.senderEmail)) {
        conversation.participants.push(email.senderEmail);
      }
      if (!conversation.participants.includes(email.recipientEmail)) {
        conversation.participants.push(email.recipientEmail);
      }
    });

    return Array.from(conversationMap.values()).sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
    );
  }, [emails]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchTerm) return conversations;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.subject.toLowerCase().includes(lowerCaseSearchTerm) ||
        conv.participants.some((p) =>
          p.toLowerCase().includes(lowerCaseSearchTerm),
        ) ||
        conv.messages.some((msg) =>
          msg.body.toLowerCase().includes(lowerCaseSearchTerm),
        ),
    );
  }, [conversations, searchTerm]);

  const sendEmailMutation = useMutation({
    mutationFn: async (data: SendEmailFormValues) => {
      const response = await apiRequest("POST", "/api/admin/emails/send", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Fehler beim Senden der E-Mail");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/emails"] });
      toast({
        title: "E-Mail gesendet",
        description: "Ihre Nachricht wurde erfolgreich gesendet.",
      });
      setComposeDialogOpen(false);
      sendForm.reset();
      setReplyMode(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Senden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markEmailAsReadMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const response = await apiRequest(
        "PUT",
        `/api/admin/emails/${emailId}/read`,
        { read: true },
      );
      if (!response.ok) {
        throw new Error("Fehler beim Markieren als gelesen.");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/emails"] });
    },
    onError: (error: Error) => {
      console.error("Fehler beim Markieren als gelesen:", error);
    },
  });

  const handleOpenConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    conversation.messages.forEach((msg) => {
      if (!msg.read) {
        markEmailAsReadMutation.mutate(msg.id);
      }
    });
  };

  const handleReplyToConversation = () => {
    if (selectedConversation) {
      setReplyMode(true);
      setComposeDialogOpen(true);
      const latestMessage = selectedConversation.messages.sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      )[0];
      sendForm.reset({
        recipient:
          latestMessage.type === "inbound"
            ? latestMessage.senderEmail
            : latestMessage.recipientEmail,
        subject: `Re: ${selectedConversation.subject}`,
        body: `\n\n--- Originalnachricht ---\n${latestMessage.body}\n-------------------------\n`,
        inReplyToMessageId: latestMessage.id,
      });
    }
  };

  const handleComposeNew = () => {
    setReplyMode(false);
    setComposeDialogOpen(true);
    sendForm.reset();
  };

  const onSubmitSendEmail = (data: SendEmailFormValues) => {
    sendEmailMutation.mutate(data);
  };

  const getLocaleForDateFns = (lang: string) => {
    switch (lang) {
      case "de":
        return de;
      case "hr":
        return hr;
      case "it":
        return it;
      case "sl":
      case "en":
      default:
        return enUS;
    }
  };
  const currentLocale = getLocaleForDateFns(language);

  if (isLoading) {
    return (
      <AdminLayout title={t("admin.inbox")}>
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title={t("admin.inbox")}>
        <div className="text-red-500 p-8">
          Fehler beim Laden der E-Mails: {error.message}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t("admin.inbox")}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("admin.mailbox.title")}</CardTitle>
            <CardDescription>{t("admin.mailbox.description")}</CardDescription>
          </div>
          <Button onClick={handleComposeNew} className="flex gap-2">
            <MailPlus size={18} />
            {t("admin.mailbox.compose")}
          </Button>
        </CardHeader>
        <CardContent>
          {selectedConversation ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setSelectedConversation(null)}
                className="mb-4"
              >
                <ChevronLeft size={20} className="mr-2" />
                {t("admin.mailbox.backToInbox")}
              </Button>
              <h2 className="text-xl font-bold">
                {selectedConversation.subject}
              </h2>
              <p className="text-sm text-gray-500">
                {t("admin.mailbox.participants")}:{" "}
                {selectedConversation.participants.join(", ")}
              </p>

              {/* ✅ KORREKTUR: Max-Höhe und Scroll-Verhalten für Nachrichtenliste */}
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
                {selectedConversation.messages
                  .sort(
                    (a, b) =>
                      new Date(a.receivedAt).getTime() -
                      new Date(b.receivedAt).getTime(),
                  )
                  .map((message) => (
                    <Card
                      key={message.id}
                      className={
                        message.type === "outbound"
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">
                          {message.type === "inbound"
                            ? t("admin.mailbox.from")
                            : t("admin.mailbox.to")}
                          :{" "}
                          {message.type === "inbound"
                            ? message.senderName || message.senderEmail
                            : message.recipientEmail}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {format(new Date(message.receivedAt), "PPP p", {
                            locale: currentLocale,
                          })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm">
                          {message.body}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleReplyToConversation}
                  className="flex gap-2"
                >
                  <Reply size={18} />
                  {t("admin.mailbox.reply")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("admin.mailbox.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              {/* ✅ KORREKTUR: Max-Höhe und Scroll-Verhalten für die Konversationsliste */}
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("admin.mailbox.noEmails")}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">
                          {t("admin.mailbox.conversation")}
                        </TableHead>
                        <TableHead>{t("admin.mailbox.subject")}</TableHead>
                        <TableHead className="w-[180px] text-right">
                          {t("admin.mailbox.lastActivity")}
                        </TableHead>
                        <TableHead className="w-[60px] text-center">
                          {t("admin.mailbox.messages")}
                        </TableHead>
                        <TableHead className="w-[60px] text-center">
                          {t("admin.mailbox.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConversations.map((conv) => (
                        <TableRow
                          key={conv.id}
                          className={
                            conv.unreadCount > 0
                              ? "bg-blue-50 hover:bg-blue-100"
                              : "hover:bg-gray-50"
                          }
                          onClick={() => handleOpenConversation(conv)}
                          style={{ cursor: "pointer" }}
                        >
                          <TableCell className="font-medium">
                            {conv.participants.join(", ")}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {conv.unreadCount > 0 &&
                                `[${t("admin.mailbox.unread")}] `}
                            </span>
                            {conv.subject}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {format(new Date(conv.lastActivity), "PPP p", {
                              locale: currentLocale,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <MessageCircle
                                size={16}
                                className="mr-1 text-muted-foreground"
                              />
                              {conv.messages.length}
                              {conv.unreadCount > 0 && (
                                <span className="ml-1 text-xs font-bold text-blue-600">
                                  ({conv.unreadCount})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenConversation(conv);
                              }}
                            >
                              <Eye size={18} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              {replyMode
                ? t("admin.mailbox.replyTitle")
                : t("admin.mailbox.composeTitle")}
            </DialogTitle>
            <DialogDescription>
              {replyMode
                ? t("admin.mailbox.replyDescription")
                : t("admin.mailbox.composeDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...sendForm}>
            <form
              onSubmit={sendForm.handleSubmit(onSubmitSendEmail)}
              className="space-y-4"
            >
              <FormField
                control={sendForm.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.mailbox.recipient")}</FormLabel>
                    <FormControl>
                      <Input placeholder="empfaenger@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sendForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.mailbox.subject")}</FormLabel>
                    <FormControl>
                      <Input placeholder="Betreff der E-Mail" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sendForm.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.mailbox.message")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ihre Nachricht hier..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setComposeDialogOpen(false)}
                >
                  {t("admin.mailbox.cancel")}
                </Button>
                <Button type="submit" disabled={sendEmailMutation.isPending}>
                  {sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("admin.mailbox.sending")}
                    </>
                  ) : (
                    t("admin.mailbox.send")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
