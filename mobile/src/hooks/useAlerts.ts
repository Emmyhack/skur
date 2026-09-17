import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Kind, ROLE_APPROVER, ROLE_GUARDIAN, ROLE_OWNER, Status } from "@web/lib/types";
import type { ProposalView, VaultData } from "@web/lib/vaultReads";
import { describeProposal } from "../lib/describe";
import { useStore } from "../state/store";
import { useMyRoles } from "./useVault";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }) });

/** Proposals the active signer can still act on: not yet confirmed by them and within their role. */
export function needsMe(vault: VaultData, roles: number, me: string | null): ProposalView[] {
  if (!me || !roles) return [];
  return vault.proposals.filter((p) => {
    if (p.status !== Status.PENDING) return false;
    const mine = p.approvers.some((a) => a.toLowerCase() === me) || p.guardianConfirmers.some((a) => a.toLowerCase() === me);
    if (mine) return false;
    if (roles & ROLE_GUARDIAN) return p.requiredGuardians > 0 || p.vetoable;
    return Boolean(roles & (p.kind === Kind.TRANSFER ? ROLE_APPROVER : ROLE_OWNER));
  });
}

/**
 * Local notifications, as Safe's "Get personalized updates": while the app polls the vault, a proposal that newly
 * needs this signer raises a notification. There is no push backend; the phone learns of it on its next read.
 */
export function useAlerts(vault: VaultData | undefined) {
  const { signer, notifications } = useStore();
  const roles = useMyRoles(vault);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!vault || !notifications) return;
    const key = `skur.seen.${vault.address.toLowerCase()}`;
    (async () => {
      if (!seen.current) { try { seen.current = new Set(JSON.parse((await AsyncStorage.getItem(key)) ?? "[]")); } catch { seen.current = new Set(); } }
      const due = needsMe(vault, roles, signer?.address.toLowerCase() ?? null).filter((p) => !seen.current!.has(String(p.id)));
      if (due.length === 0) return;
      const perm = await Notifications.getPermissionsAsync();
      const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
      for (const p of due) {
        seen.current!.add(String(p.id));
        if (granted) { const d = describeProposal(p, vault); await Notifications.scheduleNotificationAsync({ content: { title: "A transaction requires your confirmation", body: `${d.title} · ${d.detail}`, data: { url: `skur://tx/${String(p.id)}` } }, trigger: null }).catch(() => undefined); }
      }
      await AsyncStorage.setItem(key, JSON.stringify([...seen.current!]));
      await Notifications.setBadgeCountAsync(due.length).catch(() => undefined);
    })();
  }, [vault, vault?.address, vault?.proposalCount, roles, signer?.address, notifications]);
}
