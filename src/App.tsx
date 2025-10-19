import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { DialerProvider } from './contexts/DialerContext';
import { LoginForm } from './components/Auth/LoginForm';
import { CallbackHandler } from './components/Auth/CallbackHandler';
import { Sidebar } from './components/Layout/Sidebar';
import { PhoneDialer } from './components/Common/PhoneDialer';
import { IncomingCallNotification } from './components/Common/IncomingCallNotification';
import { CallModal } from './components/Common/CallModal';
import { DashboardModule } from './components/Dashboard/DashboardModule';
import { ClientsModule } from './components/Clients/ClientsModule';
import { CampaignsModule } from './components/Campaigns/CampaignsModule';
import { OrdersModule } from './components/Orders/OrdersModule';
import { InvoicesModule } from './components/Invoices/InvoicesModule';
import { CallsModule } from './components/Calls/CallsModule';
import { TicketsModule } from './components/Tickets/TicketsModule';
import { InboxModule } from './components/Inbox/InboxModule';
import { SettingsModule } from './components/Settings/SettingsModule';
import { AccountingModule } from './components/Accounting/AccountingModule';
import ParametersModule from './components/Settings/ParametersModule';
import { useTwilioDevice } from './hooks/useTwilioDevice';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function MainApp() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [incomingCallModalOpen, setIncomingCallModalOpen] = useState(false);
  const [currentIncomingCall, setCurrentIncomingCall] = useState<any>(null);
  const { isReady, device, activeCall, makeCall } = useTwilioDevice();


  const handleAcceptIncomingCall = (call: any) => {
    setCurrentIncomingCall(call);
    setIncomingCallModalOpen(true);
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'clients':
        return <ClientsModule />;
      case 'campaigns':
        return <CampaignsModule />;
      case 'orders':
        return <OrdersModule />;
      case 'invoices':
        return <InvoicesModule />;
      case 'calls':
        return <CallsModule />;
      case 'tickets':
        return <TicketsModule />;
      case 'inbox':
        return <InboxModule />;
      case 'settings':
        return <SettingsModule />;
      case 'accounting':
        return <AccountingModule />;
      case 'parameters':
        return <ParametersModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <DialerProvider>
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
        <div className="flex-1 overflow-y-auto w-full">
          <div className="pt-16 lg:pt-0">
            {renderModule()}
          </div>
        </div>
        <PhoneDialer makeCall={makeCall} isDeviceReady={isReady} activeCall={activeCall} />
        <IncomingCallNotification onAccept={handleAcceptIncomingCall} />
        {incomingCallModalOpen && currentIncomingCall && (
          <CallModal
            isOpen={incomingCallModalOpen}
            onClose={() => {
              setIncomingCallModalOpen(false);
              setCurrentIncomingCall(null);
            }}
            phoneNumber={currentIncomingCall.from_number}
            callSid={currentIncomingCall.call_sid}
            contactInfo={null}
            isIncoming={true}
            twilioCall={activeCall}
          />
        )}
      </div>
    </DialerProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/callback" element={<CallbackHandler />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainApp />
                </ProtectedRoute>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
