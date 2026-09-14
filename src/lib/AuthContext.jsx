import { queryClientInstance } from '@/lib/query-client';
import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { setWorkshopId } from '@/lib/workshop';
import { setDemoModeActive, isPublicDemo, setPublicDemo, getDemoStart } from '@/lib/demoMode';
import { isWorkshopProfileComplete } from '@/lib/workshopValidation';
import { isAlwaysAvailable } from '@/lib/alwaysAvailable';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [trialStartedAt, setTrialStartedAt] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      if (isPublicDemo()) {
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
        return;
      }
      
      try {
        const publicSettings = await base44.app.getPublicSettings();
        setAppPublicSettings(publicSettings);
        
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      setIsAuthenticated(false);
      setWorkshopId(null);
      queryClientInstance.clear();
      const visitor = isPublicDemo();
      const { data } = await base44.functions.invoke(visitor ? 'getDemoAccess' : 'manageWorkshops', { action: visitor ? 'context' : 'resolveAccess' });
      const currentUser = data.user;
      setUser(currentUser);
      setWorkshopId(currentUser?.workshop_id);
      
      let demoActive = visitor;
      const onboarding = false;
      let profileCompletion = false;
      let trialStart = null;
      
      const isPlatformOwner = data.isPlatformOwner;
      const alwaysAvailable = isAlwaysAvailable(currentUser?.email);
      
      if (currentUser?.workshop_id) {
        {
          const settings = data.workshop;
          if (!settings?.id) throw new Error("Oficina não encontrada");
          if (!visitor && settings?.plan === 'free' && !alwaysAvailable) {
            demoActive = true;
            trialStart = settings?.trial_started_at || settings?.created_date;
          }
          if (!visitor && !isWorkshopProfileComplete(settings) && !alwaysAvailable) {
            profileCompletion = true;
          }
        }
      } else if (!isPlatformOwner) {
        throw new Error('Usuário sem oficina');
      }
      
      setDemoModeActive(demoActive);
      if (visitor) trialStart = getDemoStart();
      setIsDemo(demoActive);
      setNeedsOnboarding(onboarding);
      setNeedsProfileCompletion(profileCompletion);
      setTrialStartedAt(trialStart);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setWorkshopId(null);
      setDemoModeActive(false);
      setIsDemo(false);
      setNeedsOnboarding(false);
      setNeedsProfileCompletion(false);
      setTrialStartedAt(null);
      const status = error.response?.status || error.status;
      setAuthError({
        type: status === 401 ? 'auth_required' : 'user_not_registered',
        message: error.response?.data?.error || 'Não foi possível validar o acesso à oficina.',
      });
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      

    }
  };

  const logout = (shouldRedirect = true) => {
    const visitor = isPublicDemo();
    setPublicDemo(false);
    queryClientInstance.clear();
    setDemoModeActive(false);
    setIsDemo(false);
    setUser(null);
    setIsAuthenticated(false);
    setWorkshopId(null);
    setNeedsOnboarding(false);
    setNeedsProfileCompletion(false);
    setTrialStartedAt(null);
    
    if (visitor) {
      window.location.assign('/login');
      return;
    }
    if (shouldRedirect) {
      base44.auth.logout(window.location.origin + '/login');
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    window.location.assign('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      isDemo,
      needsOnboarding,
      needsProfileCompletion,
      trialStartedAt,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};