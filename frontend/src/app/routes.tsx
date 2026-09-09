import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardLayout } from "./components/DashboardLayout";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { BackOfficeLayout } from "./layouts/BackOfficeLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { NewRequestPage } from "./pages/NewRequestPage";
import { PaymentCancelPage } from "./pages/PaymentCancelPage";
import { PaymentSuccessPage } from "./pages/PaymentSuccessPage";
import { SecurityVaultPage } from "./pages/SecurityVaultPage";
import { RewardsPage } from "./pages/RewardsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StaffPortalPage } from "./pages/StaffPortalPage";
import { StaffOverviewPage } from "./pages/staff/StaffOverviewPage";
import { StaffRequestsPage } from "./pages/staff/StaffRequestsPage";
import { StaffDevicesPage } from "./pages/staff/StaffDevicesPage";
import { StaffUnknownQueuePage } from "./pages/staff/StaffUnknownQueuePage";
import { StaffRetrievalPage } from "./pages/staff/StaffRetrievalPage";
import { StaffWipeJobsPage } from "./pages/staff/StaffWipeJobsPage";
import { StaffReferralsPage } from "./pages/staff/StaffReferralsPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminPaymentsPage } from "./pages/admin/AdminPaymentsPage";
import { AdminReferralsPage } from "./pages/admin/AdminReferralsPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { AdminSystemPage } from "./pages/admin/AdminSystemPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/auth/login",
    Component: AuthPage,
  },
  {
    path: "/auth/register",
    Component: AuthPage,
  },
  {
    path: "/auth/oauth-callback",
    Component: OAuthCallbackPage,
  },
  {
    path: "/forgot-password",
    Component: ForgotPasswordPage,
  },
  {
    path: "/reset-password",
    Component: ResetPasswordPage,
  },
  {
    Component: RequireAuth,
    children: [
      {
        Component: () => <RequireRole roles={["staff", "admin"]} />,
        children: [
          {
            Component: BackOfficeLayout,
            children: [
              {
                path: "/staff",
                Component: StaffOverviewPage,
              },
              {
                path: "/staff/requests",
                Component: StaffRequestsPage,
              },
              {
                path: "/staff/devices",
                Component: StaffDevicesPage,
              },
              {
                path: "/staff/unknown-queue",
                Component: StaffUnknownQueuePage,
              },
              {
                path: "/staff/retrieval",
                Component: StaffRetrievalPage,
              },
              {
                path: "/staff/wipe-jobs",
                Component: StaffWipeJobsPage,
              },
              {
                path: "/staff/referrals",
                Component: StaffReferralsPage,
              },
              {
                path: "/staff/workspace",
                Component: StaffPortalPage,
              },
            ],
          },
        ],
      },
      {
        Component: () => <RequireRole roles={["admin"]} />,
        children: [
          {
            Component: BackOfficeLayout,
            children: [
              {
                path: "/admin",
                Component: AdminOverviewPage,
              },
              {
                path: "/admin/users",
                Component: AdminUsersPage,
              },
              {
                path: "/admin/payments",
                Component: AdminPaymentsPage,
              },
              {
                path: "/admin/referrals",
                Component: AdminReferralsPage,
              },
              {
                path: "/admin/reports",
                Component: AdminReportsPage,
              },
              {
                path: "/admin/system",
                Component: AdminSystemPage,
              },
            ],
          },
        ],
      },
      {
        path: "/app",
        Component: DashboardLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="/app/dashboard" replace />,
          },
          {
            path: "dashboard",
            Component: DashboardPage,
          },
          {
            path: "new-request",
            Component: NewRequestPage,
          },
          {
            path: "payment/success",
            Component: PaymentSuccessPage,
          },
          {
            path: "payment/cancel",
            Component: PaymentCancelPage,
          },
          {
            path: "security-vault",
            Component: SecurityVaultPage,
          },
          {
            path: "rewards",
            Component: RewardsPage,
          },
          {
            path: "settings",
            Component: SettingsPage,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    Component: AuthPage,
  },
]);
