/**
 * OrgSetupScreen — displayed on first launch when no org config is stored.
 *
 * Accepts org configuration via:
 * 1. An incoming deep link (user tapped the setup link in their invite email)
 * 2. QR code scanning (user opens the email on desktop and scans the QR image)
 *
 * See docs/SolutionDesign.md § App Distribution — Runtime Configuration.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Linking from 'expo-linking';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { OrgConfig } from '../../types/config';
import {
  verifyAndDecodeSetupPayload,
  saveOrgConfig,
} from '../../services/config/orgConfigService';
import { logger } from '../../utils/logger';

const TAG = 'OrgSetupScreen';

interface OrgSetupScreenProps {
  /** Called when a valid org config has been verified and saved. */
  onConfigured: (config: OrgConfig) => void;
}

export default function OrgSetupScreen({ onConfigured }: OrgSetupScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const processingRef = useRef(false);

  // -----------------------------------------------------------------------
  // Deep link processing
  // -----------------------------------------------------------------------

  const processUrl = useCallback(
    async (url: string) => {
      // Guard against concurrent processing (QR fires rapidly)
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      setErrorMsg(null);

      try {
        const parsed = Linking.parse(url);
        const payload = parsed.queryParams?.payload as string | undefined;
        const sig = parsed.queryParams?.sig as string | undefined;

        if (!payload || !sig) {
          setErrorMsg('Invalid setup link — missing payload or signature.');
          return;
        }

        const result = await verifyAndDecodeSetupPayload(payload, sig);

        if (!result.ok) {
          setErrorMsg(result.error);
          return;
        }

        await saveOrgConfig(result.config);
        logger.info(TAG, `Org configured: ${result.config.orgCode}`);
        onConfigured(result.config);
      } catch (err) {
        logger.error(TAG, 'Error processing setup URL', err);
        setErrorMsg('An unexpected error occurred while processing the setup link.');
      } finally {
        setProcessing(false);
        // Allow re-scanning after a short delay (prevents rapid-fire on the same QR)
        setTimeout(() => {
          processingRef.current = false;
        }, 2000);
      }
    },
    [onConfigured],
  );

  // Check for an incoming deep link on mount
  useEffect(() => {
    let cancelled = false;

    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !cancelled) {
          logger.info(TAG, 'Received initial deep link');
          await processUrl(initialUrl);
        }
      } catch (err) {
        logger.error(TAG, 'Error checking initial URL', err);
      }
    };

    checkInitialUrl();

    // Also handle deep links that arrive while the screen is mounted
    const subscription = Linking.addEventListener('url', (event) => {
      if (!cancelled) {
        logger.info(TAG, 'Received deep link while mounted');
        processUrl(event.url);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [processUrl]);

  // -----------------------------------------------------------------------
  // QR code scanning
  // -----------------------------------------------------------------------

  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (result.data) {
        processUrl(result.data);
      }
    },
    [processUrl],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // Camera permissions not yet determined
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="directions-bike" size={60} color={COLORS.primary} />
        <Text style={styles.title}>Tour Check-In</Text>
        <Text style={styles.subtitle}>Organisation Setup</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Text style={styles.instructionText}>
          To get started, open the <Text style={styles.bold}>invite email</Text> from your tour
          organiser and tap the <Text style={styles.bold}>setup link</Text>. If you received the
          email on another device, scan the <Text style={styles.bold}>QR code</Text> in the email
          below.
        </Text>
      </View>

      {/* Error banner */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={20} color={COLORS.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* QR Scanner area */}
      {processing ? (
        <View style={styles.scannerPlaceholder}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.processingText}>Verifying setup link…</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.scannerPlaceholder}>
          <MaterialIcons name="camera-alt" size={48} color={COLORS.gray[400]} />
          <Text style={styles.permissionText}>
            Camera permission is required to scan the QR code.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScan}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
          <Text style={styles.scanHint}>Position the QR code within the frame</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  instructionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  scannerContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 16,
  },
  scanHint: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  scannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  processingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  permissionText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
