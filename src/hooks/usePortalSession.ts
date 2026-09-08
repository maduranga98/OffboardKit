import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { portalAuth, portalFunctions } from "../lib/firebase";

export interface PortalSession {
  flowId: string;
  companyId: string;
}

export interface SurveySession {
  responseId: string;
  surveyId: string;
  companyId: string;
}

type SessionState<T> =
  | { status: "loading"; session?: undefined; error?: undefined }
  | { status: "ready"; session: T; error?: undefined }
  | { status: "error"; session?: undefined; error: string };

const GENERIC_ERROR = "This link is invalid or has expired.";

/**
 * Exchanges the link token in the URL for a Firebase custom token scoped to a
 * single offboarding flow, then signs into the isolated portal auth app.
 *
 * Nothing in the portal reads Firestore until this resolves: security rules
 * grant access off the minted `flowId` claim, never off the raw token, so the
 * visitor can only ever reach the one flow their link belongs to.
 */
export function usePortalSession(token: string | undefined) {
  // Keyed by token so a token change reads as "loading" during render rather
  // than needing a synchronous setState reset inside the effect.
  const [result, setResult] = useState<{
    token: string;
    state: SessionState<PortalSession>;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const redeem = httpsCallable<
          { token: string },
          { customToken: string; flowId: string; companyId: string }
        >(portalFunctions, "redeemPortalToken");
        const { data } = await redeem({ token });
        await signInWithCustomToken(portalAuth, data.customToken);
        if (cancelled) return;
        setResult({
          token,
          state: {
            status: "ready",
            session: { flowId: data.flowId, companyId: data.companyId },
          },
        });
      } catch (err) {
        console.error("Portal session error:", err);
        if (!cancelled) {
          setResult({ token, state: { status: "error", error: GENERIC_ERROR } });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return {
      status: "error",
      error: "No portal token provided.",
    } as SessionState<PortalSession>;
  }
  return result?.token === token
    ? result.state
    : ({ status: "loading" } as SessionState<PortalSession>);
}

/** Same exchange for standalone pulse-survey links. */
export function useSurveySession(token: string | undefined) {
  const [result, setResult] = useState<{
    token: string;
    state: SessionState<SurveySession>;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const redeem = httpsCallable<
          { token: string },
          {
            customToken: string;
            responseId: string;
            surveyId: string;
            companyId: string;
          }
        >(portalFunctions, "redeemSurveyToken");
        const { data } = await redeem({ token });
        await signInWithCustomToken(portalAuth, data.customToken);
        if (cancelled) return;
        setResult({
          token,
          state: {
            status: "ready",
            session: {
              responseId: data.responseId,
              surveyId: data.surveyId,
              companyId: data.companyId,
            },
          },
        });
      } catch (err) {
        console.error("Survey session error:", err);
        if (!cancelled) {
          setResult({ token, state: { status: "error", error: GENERIC_ERROR } });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return {
      status: "error",
      error: "No survey token provided.",
    } as SessionState<SurveySession>;
  }
  return result?.token === token
    ? result.state
    : ({ status: "loading" } as SessionState<SurveySession>);
}
