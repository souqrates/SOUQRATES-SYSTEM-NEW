import {
  useListPendingDeposits,
  useConfirmDeposit,
  useRejectDeposit,
  getListPendingDepositsQueryKey,
  getListAllTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function DepositsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deposits, isLoading } = useListPendingDeposits({
    query: { queryKey: getListPendingDepositsQueryKey() },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListPendingDepositsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAllTransactionsQueryKey() });
  };

  const confirmMut = useConfirmDeposit();
  const rejectMut = useRejectDeposit();
  const isBusy = confirmMut.isPending || rejectMut.isPending;

  const handleConfirm = (transactionId: number) => {
    confirmMut.mutate(
      { transactionId },
      {
        onSuccess: (result) => {
          toast({
            title: result.status === "already_confirmed" ? "Already Confirmed" : "Deposit Confirmed",
            description: `Transaction #${transactionId} credited and commissions processed`,
          });
          refresh();
        },
        onError: () => {
          toast({ title: "Confirm Failed", description: `Could not confirm transaction #${transactionId}`, variant: "destructive" });
        },
      }
    );
  };

  const handleReject = (transactionId: number) => {
    rejectMut.mutate(
      { transactionId },
      {
        onSuccess: () => {
          toast({ title: "Deposit Rejected", description: `Transaction #${transactionId} marked as failed` });
          refresh();
        },
        onError: () => {
          toast({ title: "Reject Failed", description: `Could not reject transaction #${transactionId}`, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-orbitron font-bold text-foreground">PENDING DEPOSITS</h2>
          <p className="text-xs text-muted-foreground font-orbitron mt-1">
            Verify on-chain payment before crediting SKZ. Confirming runs referral commissions.
          </p>
        </div>
        <Badge variant="secondary" className="font-orbitron text-xs">
          {deposits?.length ?? 0} PENDING
        </Badge>
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-orbitron text-xs">TX ID</TableHead>
              <TableHead className="font-orbitron text-xs">USER</TableHead>
              <TableHead className="font-orbitron text-xs text-right">AMOUNT</TableHead>
              <TableHead className="font-orbitron text-xs">CURRENCY</TableHead>
              <TableHead className="font-orbitron text-xs">TX HASH</TableHead>
              <TableHead className="font-orbitron text-xs text-right">DATE</TableHead>
              <TableHead className="font-orbitron text-xs text-center">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading pending deposits...</TableCell>
              </TableRow>
            ) : !deposits || deposits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-orbitron tracking-wider">No pending deposits</TableCell>
              </TableRow>
            ) : (
              deposits.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.id}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-orbitron">{d.username || "—"}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{d.telegramId}</div>
                  </TableCell>
                  <TableCell className="text-right font-orbitron font-bold text-skz">
                    +{d.amount.toLocaleString()} SKZ
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-orbitron text-[10px]">{d.currency || "—"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[160px] truncate" title={d.txHash || undefined}>
                    {d.txHash || "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        className="font-orbitron text-[10px] h-7 bg-green-600 hover:bg-green-700"
                        disabled={isBusy}
                        onClick={() => handleConfirm(d.id)}
                      >
                        CONFIRM
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="font-orbitron text-[10px] h-7"
                        disabled={isBusy}
                        onClick={() => handleReject(d.id)}
                      >
                        REJECT
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
