import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";

type Page<T> = { results: T[] };
type Booking = {
  id: number;
  is_client: boolean;
  is_provider: boolean;
  status: string;
  provider_name: string;
  final_price: string;
  currency: string;
};
type Payment = { booking_id: number; status: string };
type Dispute = {
  id: number;
  booking_id: number;
  category: string;
  description: string;
  status: string;
};
type DisputeMessage = { id: number; author_id: number | null; body: string; created_at: string };
type RefundRequest = {
  id: number;
  booking_id: number;
  requested_by_id: number | null;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  decision_note: string;
  payout_reference: string;
};

const categories = [
  ["SERVICE_NOT_DELIVERED", "Serviço não prestado"],
  ["LATE_OR_NO_SHOW", "Atraso / falta"],
  ["QUALITY", "Qualidade"],
  ["SCOPE_OR_PRICE", "Âmbito / preço"],
  ["INTERRUPTION", "Interrupção"],
  ["REFUND", "Reembolso"],
  ["OTHER", "Outro"],
] as const;

const disputeStates: Record<string, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  CLOSED: "Fechada",
};

const refundStates: Record<string, string> = {
  REQUESTED: "A aguardar análise",
  APPROVED: "A aguardar devolução",
  REJECTED: "Rejeitado",
  PAID: "Confirmado pelo prestador",
  CANCELLED: "Cancelado",
};

export default function CasesScreen() {
  const { account, isLoading: sessionLoading } = useSession();
  const params = useLocalSearchParams<{ disputa?: string; reembolso?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);
  const [selectedRefundId, setSelectedRefundId] = useState<number | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>(categories[0][0]);
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const [refundBookingId, setRefundBookingId] = useState<number | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [payoutReferences, setPayoutReferences] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const [bookingPage, paymentPage, disputePage, refundPage] = await Promise.all([
        apiRequest<Page<Booking>>("/bookings/"),
        apiRequest<Page<Payment>>("/payments/"),
        apiRequest<Page<Dispute>>("/disputes/"),
        apiRequest<Page<RefundRequest>>("/refund-requests/"),
      ]);
      setBookings(bookingPage.results ?? []);
      setPayments(paymentPage.results ?? []);
      setDisputes(disputePage.results ?? []);
      setRefunds(refundPage.results ?? []);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Não foi possível carregar os teus casos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const id = Number(params.disputa);
    if (Number.isInteger(id) && id > 0) setSelectedDisputeId(id);
  }, [params.disputa]);

  useEffect(() => {
    const id = Number(params.reembolso);
    if (Number.isInteger(id) && id > 0) setSelectedRefundId(id);
  }, [params.reembolso]);

  useEffect(() => {
    if (!selectedDisputeId) {
      setMessages([]);
      return;
    }
    let active = true;
    setMessages([]);
    apiRequest<Page<DisputeMessage>>(`/disputes/${selectedDisputeId}/messages/`)
      .then((page) => { if (active) setMessages(page.results ?? []); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason.message : "Não foi possível carregar as mensagens.");
      });
    return () => { active = false; };
  }, [selectedDisputeId]);

  const confirmedBookingIds = useMemo(
    () => new Set(payments.filter((payment) => payment.status === "CONFIRMED").map((payment) => payment.booking_id)),
    [payments],
  );
  const refundableBookings = useMemo(
    () => bookings.filter((booking) => booking.is_client && confirmedBookingIds.has(booking.id)),
    [bookings, confirmedBookingIds],
  );
  const selectedDispute = disputes.find((item) => item.id === selectedDisputeId);

  async function refresh() {
    setRefreshing(true);
    await load();
  }

  async function post<T>(path: string, body: unknown, success: string): Promise<T | null> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
      setNotice(success);
      await load();
      return result;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Não foi possível enviar. Tenta novamente.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openDispute() {
    if (!selectedBookingId || !description.trim()) return;
    const dispute = await post<Dispute>("/disputes/", {
      booking_id: selectedBookingId,
      category,
      description: description.trim(),
    }, "Disputa aberta. A outra parte será notificada.");
    if (dispute) {
      setDescription("");
      setSelectedDisputeId(dispute.id);
    }
  }

  async function sendReply() {
    if (!selectedDisputeId || !reply.trim()) return;
    const sent = await post<DisputeMessage>(
      `/disputes/${selectedDisputeId}/messages/`,
      { body: reply.trim() },
      "Mensagem enviada.",
    );
    if (sent) {
      setReply("");
      try {
        const page = await apiRequest<Page<DisputeMessage>>(`/disputes/${selectedDisputeId}/messages/`);
        setMessages(page.results ?? []);
      } catch (reason) {
        setError(reason instanceof ApiError ? reason.message : "A mensagem foi enviada, mas não foi possível actualizar a conversa.");
      }
    }
  }

  async function requestRefund() {
    if (!refundBookingId || !refundAmount.trim() || !refundReason.trim()) return;
    const created = await post<RefundRequest>("/refund-requests/", {
      booking_id: refundBookingId,
      amount: refundAmount,
      reason: refundReason.trim(),
    }, "Pedido registado. O prestador terá de devolver o valor fora da plataforma.");
    if (created) {
      setRefundAmount("");
      setRefundReason("");
    }
  }

  async function confirmRefund(item: RefundRequest) {
    const reference = payoutReferences[item.id]?.trim();
    if (!reference) {
      setError("Indica a referência da transferência.");
      return;
    }
    const confirmed = await post<RefundRequest>(
      `/refund-requests/${item.id}/confirm-paid/`,
      { payout_reference: reference },
      "Devolução registada como confirmada pelo prestador.",
    );
    if (confirmed) setPayoutReferences((current) => ({ ...current, [item.id]: "" }));
  }

  async function cancelRefund(item: RefundRequest) {
    await post(`/refund-requests/${item.id}/cancel/`, {}, "Pedido de reembolso cancelado.");
  }

  if (sessionLoading || loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color="#2563EB" /><Text accessibilityLiveRegion="polite" style={styles.muted}>A carregar os teus casos…</Text></SafeAreaView>;
  }

  if (!account) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}><Text style={styles.title}>Apoio à contratação</Text><Text style={styles.muted}>Inicia sessão para acompanhar disputas e reembolsos.</Text><Link href="/entrar" style={styles.link}>Iniciar sessão</Link></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>APOIO À CONTRATAÇÃO</Text>
          <Text style={styles.title}>Disputas e reembolsos</Text>
          <Text style={styles.subtitle}>Acompanha um caso e fala com a outra parte.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>{refreshing ? "A actualizar…" : "Actualizar"}</Text>
          </Pressable>
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Abrir disputa</Text>
          <Text style={styles.subtitle}>Descreve o problema. Não incluas dados bancários nem credenciais.</Text>
          <Text style={styles.fieldLabel}>Contratação</Text>
          <View style={styles.chips}>
            {bookings.map((booking) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedBookingId === booking.id }}
                key={booking.id}
                onPress={() => setSelectedBookingId(booking.id)}
                style={[styles.chip, selectedBookingId === booking.id && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selectedBookingId === booking.id && styles.chipTextSelected]}>#{booking.id} · {booking.provider_name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Motivo</Text>
          <View style={styles.chips}>
            {categories.map(([value, label]) => (
              <Pressable key={value} onPress={() => setCategory(value)} style={[styles.chip, category === value && styles.chipSelected]}>
                <Text style={[styles.chipText, category === value && styles.chipTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Descrição da disputa"
            maxLength={5000}
            multiline
            onChangeText={setDescription}
            placeholder="Explica os factos e o que precisas de resolver."
            style={[styles.input, styles.multiline]}
            value={description}
          />
          <Pressable disabled={busy || !selectedBookingId || !description.trim()} onPress={() => void openDispute()} style={[styles.primary, (busy || !selectedBookingId || !description.trim()) && styles.disabled]}>
            <Text style={styles.primaryText}>{busy ? "A enviar…" : "Abrir disputa"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Disputas existentes</Text>
          {!disputes.length ? <Text style={styles.muted}>Ainda não tens disputas abertas.</Text> : null}
          {disputes.map((dispute) => (
            <Pressable key={dispute.id} onPress={() => setSelectedDisputeId(dispute.id)} style={[styles.listItem, selectedDisputeId === dispute.id && styles.selectedItem]}>
              <View style={styles.row}><Text style={styles.itemTitle}>Caso #{dispute.id} · Contratação #{dispute.booking_id}</Text><Text style={styles.badge}>{disputeStates[dispute.status] ?? dispute.status}</Text></View>
              <Text style={styles.itemText}>{categories.find(([key]) => key === dispute.category)?.[1] ?? dispute.category}</Text>
              <Text numberOfLines={3} style={styles.muted}>{dispute.description}</Text>
            </Pressable>
          ))}
          {selectedDispute ? (
            <View style={styles.thread}>
              <Text style={styles.fieldLabel}>Conversa do caso #{selectedDispute.id}</Text>
              {messages.map((message) => (
                <View key={message.id} style={styles.messageBubble}>
                  <Text style={styles.itemText}>{message.body}</Text>
                  <Text style={styles.timestamp}>{new Date(message.created_at).toLocaleString("pt-AO")}</Text>
                </View>
              ))}
              {!messages.length ? <Text style={styles.muted}>Ainda não há respostas.</Text> : null}
              {["OPEN", "UNDER_REVIEW"].includes(selectedDispute.status) ? (
                <>
                  <TextInput accessibilityLabel="Mensagem para a disputa" maxLength={4000} multiline onChangeText={setReply} placeholder="Escreve uma resposta…" style={[styles.input, styles.multiline]} value={reply} />
                  <Pressable disabled={busy || !reply.trim()} onPress={() => void sendReply()} style={[styles.secondary, (busy || !reply.trim()) && styles.disabled]}><Text style={styles.secondaryText}>Enviar resposta</Text></Pressable>
                </>
              ) : <Text style={styles.muted}>Este caso já não aceita novas mensagens.</Text>}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pedir reembolso</Text>
          <Text style={styles.notice}>A plataforma não movimenta dinheiro. O prestador faz a devolução e regista a referência.</Text>
          {!refundableBookings.length ? <Text style={styles.muted}>É necessário existir um pagamento confirmado numa contratação tua.</Text> : null}
          <View style={styles.chips}>
            {refundableBookings.map((booking) => (
              <Pressable key={booking.id} onPress={() => setRefundBookingId(booking.id)} style={[styles.chip, refundBookingId === booking.id && styles.chipSelected]}>
                <Text style={[styles.chipText, refundBookingId === booking.id && styles.chipTextSelected]}>#{booking.id} · {booking.final_price} {booking.currency}</Text>
              </Pressable>
            ))}
          </View>
          {refundableBookings.length ? (
            <>
              <TextInput accessibilityLabel="Valor do reembolso" keyboardType="decimal-pad" onChangeText={setRefundAmount} placeholder="Valor a pedir" style={styles.input} value={refundAmount} />
              <TextInput accessibilityLabel="Motivo do reembolso" maxLength={3000} multiline onChangeText={setRefundReason} placeholder="Explica o motivo" style={[styles.input, styles.multiline]} value={refundReason} />
              <Pressable disabled={busy || !refundBookingId || !refundAmount.trim() || !refundReason.trim()} onPress={() => void requestRefund()} style={[styles.primary, (busy || !refundBookingId || !refundAmount.trim() || !refundReason.trim()) && styles.disabled]}><Text style={styles.primaryText}>Enviar pedido</Text></Pressable>
            </>
          ) : null}
          {refunds.map((item) => {
            const booking = bookings.find((current) => current.id === item.booking_id);
            return (
              <View key={item.id} style={[styles.listItem, selectedRefundId === item.id && styles.selectedItem]}>
                <View style={styles.row}><Text style={styles.itemTitle}>Pedido #{item.id} · Contratação #{item.booking_id}</Text><Text style={styles.badge}>{refundStates[item.status] ?? item.status}</Text></View>
                <Text style={styles.itemText}>{item.amount} {item.currency} · {item.reason}</Text>
                {item.decision_note ? <Text style={styles.muted}>{item.decision_note}</Text> : null}
                {booking?.is_provider && item.status === "APPROVED" ? (
                  <>
                    <TextInput accessibilityLabel="Referência da devolução" maxLength={120} onChangeText={(value) => setPayoutReferences((current) => ({ ...current, [item.id]: value }))} placeholder="Referência da transferência" style={styles.input} value={payoutReferences[item.id] ?? ""} />
                    <Pressable disabled={busy || !payoutReferences[item.id]?.trim()} onPress={() => void confirmRefund(item)} style={[styles.secondary, (busy || !payoutReferences[item.id]?.trim()) && styles.disabled]}><Text style={styles.secondaryText}>Confirmar devolução</Text></Pressable>
                  </>
                ) : null}
                {item.requested_by_id === account.id && item.status === "REQUESTED" ? (
                  <Pressable accessibilityRole="button" onPress={() => Alert.alert("Cancelar pedido", "Queres cancelar este pedido de reembolso?", [{ text: "Manter", style: "cancel" }, { text: "Cancelar pedido", style: "destructive", onPress: () => void cancelRefund(item) }])}>
                    <Text style={styles.cancelText}>Cancelar pedido</Text>
                  </Pressable>
                ) : null}
                {item.payout_reference ? <Text style={styles.muted}>Referência: {item.payout_reference}</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F8FC" },
  content: { gap: 14, padding: 16, paddingBottom: 32 },
  header: { paddingVertical: 10 },
  eyebrow: { color: "#356DA8", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: "#17345E", fontSize: 27, fontWeight: "800", marginTop: 7 },
  subtitle: { color: "#617184", fontSize: 13, lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: "#17345E", fontSize: 18, fontWeight: "800" },
  fieldLabel: { color: "#34465D", fontSize: 12, fontWeight: "800", marginTop: 7 },
  card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8F0", borderRadius: 17, borderWidth: 1, gap: 12, padding: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#F4F7FA", borderColor: "#DCE5EE", borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  chipSelected: { backgroundColor: "#EAF2FF", borderColor: "#6C9CDB" },
  chipText: { color: "#52647A", fontSize: 11, fontWeight: "700" },
  chipTextSelected: { color: "#214F84" },
  input: { backgroundColor: "#FFFFFF", borderColor: "#D3DDE8", borderRadius: 10, borderWidth: 1, color: "#24374E", fontSize: 14, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 86, textAlignVertical: "top" },
  primary: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  secondary: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F0F6FF", borderColor: "#CAD8E8", borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  secondaryText: { color: "#214D7D", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  listItem: { backgroundColor: "#FBFCFE", borderColor: "#E2E8EF", borderRadius: 13, borderWidth: 1, gap: 8, padding: 13 },
  selectedItem: { backgroundColor: "#F4F8FF", borderColor: "#7BA7DF" },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  itemTitle: { color: "#243C5A", flex: 1, fontSize: 13, fontWeight: "800" },
  itemText: { color: "#53657A", fontSize: 12, lineHeight: 18 },
  badge: { backgroundColor: "#EDF4FB", borderRadius: 99, color: "#365A80", fontSize: 10, fontWeight: "800", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  muted: { color: "#718096", fontSize: 12, lineHeight: 18 },
  thread: { borderTopColor: "#E2E8EF", borderTopWidth: 1, gap: 9, paddingTop: 14 },
  messageBubble: { alignSelf: "flex-start", backgroundColor: "#F5F8FC", borderRadius: 11, gap: 5, maxWidth: "92%", padding: 11 },
  timestamp: { color: "#8190A0", fontSize: 10 },
  notice: { backgroundColor: "#F3F8FF", borderColor: "#D9E7F5", borderRadius: 10, borderWidth: 1, color: "#526780", fontSize: 12, lineHeight: 18, padding: 11 },
  error: { backgroundColor: "#FFF0EF", borderRadius: 10, color: "#A33232", fontSize: 12, padding: 11 },
  cancelText: { color: "#A33237", fontSize: 12, fontWeight: "800", paddingVertical: 5 },
  refreshButton: { alignSelf: "flex-start", backgroundColor: "#EAF2FF", borderRadius: 9, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: "#214F84", fontSize: 12, fontWeight: "800" },
  link: { color: "#2563EB", fontWeight: "800", marginTop: 16 },
});
