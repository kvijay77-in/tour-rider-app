/**
 * CheckInScreen — QR-code-based rider check-in.
 *
 * Flow:
 * 1. Select check-in type (regular, Not Riding, Quit Riding)
 * 2. Scan rider QR code (contains rider ID)
 * 3. After 3 failed scans → manual Rider ID fallback
 * 4. Submit check-in to backend
 *
 * See docs/Requirements.md § Check-In and docs/SolutionDesign.md § Check-In Flow.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import { createCheckIn } from '../../services/api/checkInApi';
import { COLORS, QR_SCANNER_COLORS, getStageColor } from '../../constants/colors';
import { CheckInMethod, Permission, Ride, Stage, StageType } from '../../types/models';
import { CheckInRequest } from '../../types/api';
import { hasPermission } from '../../utils/permissions';
import { logger } from '../../utils/logger';

const TAG = 'CheckInScreen';

/** Max QR scan retries before showing manual input */
const MAX_SCAN_RETRIES = 3;

type CheckInType = 'regular' | 'not_riding' | 'quit_riding';

interface CheckInScreenProps {
  ride: Ride;
  /** Called when check-in completes successfully — dashboard should refresh */
  onCheckInComplete: () => void;
  /** Called when user closes the screen */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Stage selector
// ---------------------------------------------------------------------------

function StageSelector({
  stages,
  selectedStage,
  onSelect,
  checkInType,
}: {
  stages: Stage[];
  selectedStage: Stage | null;
  onSelect: (stage: Stage) => void;
  checkInType: CheckInType;
}) {
  // For Not Riding, always use the Start stage
  const filteredStages = checkInType === 'not_riding'
    ? stages.filter((s) => s.type === StageType.START)
    : stages;

  return (
    <View style={stageStyles.container}>
      <Text style={stageStyles.label}>
        {checkInType === 'not_riding' ? 'Stage (auto-selected)' : 'Select Stage'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={stageStyles.scrollContent}>
        {filteredStages.map((stage) => {
          const isSelected = selectedStage?.stageId === stage.stageId;
          const color = getStageColor(stage.stageNumber, stages.length);
          return (
            <TouchableOpacity
              key={stage.stageId}
              style={[
                stageStyles.chip,
                { borderColor: color },
                isSelected && { backgroundColor: color },
              ]}
              onPress={() => onSelect(stage)}
              disabled={checkInType === 'not_riding'}
            >
              <Text
                style={[
                  stageStyles.chipText,
                  { color: isSelected ? COLORS.white : color },
                ]}
              >
                {stage.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const stageStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  scrollContent: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type Phase = 'type_select' | 'stage_select' | 'scanning' | 'manual_entry' | 'confirming' | 'success' | 'error';

export default function CheckInScreen({ ride, onCheckInComplete, onClose }: CheckInScreenProps) {
  const { user } = useAuth();
  const { tour } = useTour();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('type_select');
  const [checkInType, setCheckInType] = useState<CheckInType>('regular');
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [scannedRiderId, setScannedRiderId] = useState<string>('');
  const [manualRiderId, setManualRiderId] = useState<string>('');
  const [scanAttempts, setScanAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const processingRef = useRef(false);

  // Determine available check-in types based on role
  const canCheckInRegular = hasPermission(user!.userRole, Permission.CHECKIN_RIDER);
  const canCheckInNR = hasPermission(user!.userRole, Permission.CHECKIN_NOT_RIDING);
  const canCheckInQR = hasPermission(user!.userRole, Permission.CHECKIN_QUIT_RIDING);
  const canManualCheckIn = hasPermission(user!.userRole, Permission.MANUAL_CHECKIN);

  // Auto-select Start stage for NR
  useEffect(() => {
    if (checkInType === 'not_riding') {
      const startStage = ride.stages.find((s) => s.type === StageType.START);
      if (startStage) setSelectedStage(startStage);
    }
  }, [checkInType, ride.stages]);

  // -----------------------------------------------------------------------
  // Check-in type selection
  // -----------------------------------------------------------------------

  const selectCheckInType = (type: CheckInType) => {
    setCheckInType(type);
    setPhase('stage_select');
  };

  const selectStageAndScan = (stage: Stage) => {
    setSelectedStage(stage);
    setPhase('scanning');
    setScanAttempts(0);
    setScannedRiderId('');
    processingRef.current = false;
  };

  // -----------------------------------------------------------------------
  // QR Scanning
  // -----------------------------------------------------------------------

  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (processingRef.current) return;
      const riderId = result.data?.trim();
      if (!riderId) return;

      processingRef.current = true;
      Vibration.vibrate(100);
      setScannedRiderId(riderId);
      setPhase('confirming');
    },
    [],
  );

  const handleScanRetry = () => {
    const newAttempts = scanAttempts + 1;
    setScanAttempts(newAttempts);
    processingRef.current = false;
    setScannedRiderId('');

    if (newAttempts >= MAX_SCAN_RETRIES) {
      logger.info(TAG, `Max scan retries (${MAX_SCAN_RETRIES}) reached — showing manual entry`);
      setPhase('manual_entry');
    } else {
      setPhase('scanning');
    }
  };

  const switchToManualEntry = () => {
    setPhase('manual_entry');
  };

  const confirmManualEntry = () => {
    const trimmed = manualRiderId.trim();
    if (!trimmed) return;
    setScannedRiderId(trimmed);
    setPhase('confirming');
  };

  // -----------------------------------------------------------------------
  // Submit check-in
  // -----------------------------------------------------------------------

  const submitCheckIn = async () => {
    if (!tour || !selectedStage || !scannedRiderId) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const method: CheckInMethod =
        phase === 'confirming' && scanAttempts >= MAX_SCAN_RETRIES
          ? CheckInMethod.FALLBACK
          : manualRiderId.trim() === scannedRiderId
            ? CheckInMethod.MANUAL
            : CheckInMethod.QR_SCAN;

      const request: CheckInRequest = {
        riderId: scannedRiderId,
        rideId: ride.rideId,
        stageNumber: selectedStage.stageNumber,
        method,
        isNotRiding: checkInType === 'not_riding',
        isQuitRiding: checkInType === 'quit_riding',
      };

      await createCheckIn(tour.tourId, request);

      const typeLabel =
        checkInType === 'not_riding' ? 'Not Riding' :
        checkInType === 'quit_riding' ? 'Quit Riding' :
        selectedStage.name;
      setResultMessage(`${scannedRiderId} — ${typeLabel} ✓`);
      setPhase('success');
      logger.info(TAG, `Check-in recorded: ${scannedRiderId} at ${selectedStage.name} (${checkInType})`);
    } catch (err) {
      logger.error(TAG, 'Check-in submission failed', err);
      const message = err instanceof Error ? err.message : 'Check-in failed. Please try again.';
      setErrorMessage(message);
      setPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // After a successful check-in, allow scanning the next rider
  const scanNextRider = () => {
    setScannedRiderId('');
    setManualRiderId('');
    setScanAttempts(0);
    processingRef.current = false;
    setPhase('scanning');
    onCheckInComplete();
  };

  // Reset to type selection
  const resetToStart = () => {
    setPhase('type_select');
    setCheckInType('regular');
    setSelectedStage(null);
    setScannedRiderId('');
    setManualRiderId('');
    setScanAttempts(0);
    setErrorMessage('');
    processingRef.current = false;
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderTypeSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Check-In Type</Text>
      {canCheckInRegular && (
        <TouchableOpacity style={styles.typeButton} onPress={() => selectCheckInType('regular')}>
          <MaterialIcons name="qr-code-scanner" size={24} color={COLORS.primary} />
          <View style={styles.typeButtonText}>
            <Text style={styles.typeButtonTitle}>Regular Check-In</Text>
            <Text style={styles.typeButtonSubtitle}>Scan rider at a stage</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.gray[400]} />
        </TouchableOpacity>
      )}
      {canCheckInNR && (
        <TouchableOpacity style={styles.typeButton} onPress={() => selectCheckInType('not_riding')}>
          <MaterialIcons name="do-not-disturb" size={24} color={COLORS.gray[500]} />
          <View style={styles.typeButtonText}>
            <Text style={styles.typeButtonTitle}>Not Riding</Text>
            <Text style={styles.typeButtonSubtitle}>Mark rider as not participating today</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.gray[400]} />
        </TouchableOpacity>
      )}
      {canCheckInQR && (
        <TouchableOpacity style={styles.typeButton} onPress={() => selectCheckInType('quit_riding')}>
          <MaterialIcons name="cancel" size={24} color="#B91C1C" />
          <View style={styles.typeButtonText}>
            <Text style={styles.typeButtonTitle}>Quit Riding</Text>
            <Text style={styles.typeButtonSubtitle}>Rider leaving mid-ride</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.gray[400]} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStageSelection = () => (
    <View style={styles.section}>
      <StageSelector
        stages={ride.stages}
        selectedStage={selectedStage}
        onSelect={selectStageAndScan}
        checkInType={checkInType}
      />
      {checkInType === 'not_riding' && selectedStage && (
        <TouchableOpacity style={styles.primaryButton} onPress={() => setPhase('scanning')}>
          <Text style={styles.primaryButtonText}>Continue to Scan</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderScanner = () => {
    if (!permission?.granted) {
      return (
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={48} color={COLORS.gray[400]} />
          <Text style={styles.permissionText}>Camera access is required for QR scanning.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
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
        <View style={styles.scannerFooter}>
          <Text style={styles.scanHint}>
            Scan rider QR code{scanAttempts > 0 ? ` (attempt ${scanAttempts + 1}/${MAX_SCAN_RETRIES})` : ''}
          </Text>
          {canManualCheckIn && (
            <TouchableOpacity style={styles.manualEntryLink} onPress={switchToManualEntry}>
              <Text style={styles.manualEntryLinkText}>Enter Rider ID manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderManualEntry = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.section}
    >
      <Text style={styles.sectionTitle}>Enter Rider ID</Text>
      {scanAttempts >= MAX_SCAN_RETRIES && (
        <View style={styles.infoBanner}>
          <MaterialIcons name="info-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoBannerText}>
            QR scan failed after {MAX_SCAN_RETRIES} attempts. Enter the rider ID manually.
          </Text>
        </View>
      )}
      <View style={styles.manualInputRow}>
        <TextInput
          style={styles.manualInput}
          value={manualRiderId}
          onChangeText={setManualRiderId}
          placeholder="e.g. R1, R57"
          placeholderTextColor={COLORS.textDisabled}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={confirmManualEntry}
        />
        <TouchableOpacity
          style={[styles.primaryButton, styles.manualSubmitButton, !manualRiderId.trim() && styles.disabledButton]}
          onPress={confirmManualEntry}
          disabled={!manualRiderId.trim()}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderConfirmation = () => {
    const typeLabel =
      checkInType === 'not_riding' ? 'Not Riding' :
      checkInType === 'quit_riding' ? 'Quit Riding' :
      'Check-In';

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Confirm {typeLabel}</Text>
        <View style={styles.confirmCard}>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Rider ID</Text>
            <Text style={styles.confirmValue}>{scannedRiderId}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Stage</Text>
            <Text style={styles.confirmValue}>{selectedStage?.name ?? '—'}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Type</Text>
            <Text style={styles.confirmValue}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.confirmButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
            onPress={submitCheckIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleScanRetry} disabled={isSubmitting}>
            <Text style={styles.secondaryButtonText}>Re-scan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccess = () => (
    <View style={styles.resultContainer}>
      <MaterialIcons name="check-circle" size={64} color={COLORS.success} />
      <Text style={styles.resultText}>{resultMessage}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={scanNextRider}>
        <Text style={styles.primaryButtonText}>Scan Next Rider</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.resultContainer}>
      <MaterialIcons name="error" size={64} color={COLORS.danger} />
      <Text style={styles.errorResultText}>{errorMessage}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={submitCheckIn}>
        <Text style={styles.primaryButtonText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={resetToStart}>
        <Text style={styles.secondaryButtonText}>Start Over</Text>
      </TouchableOpacity>
    </View>
  );

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  const phaseTitle: Record<Phase, string> = {
    type_select: 'Check-In',
    stage_select: 'Select Stage',
    scanning: 'Scan QR Code',
    manual_entry: 'Manual Entry',
    confirming: 'Confirm',
    success: 'Check-In Recorded',
    error: 'Check-In Failed',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{phaseTitle[phase]}</Text>
        {phase !== 'type_select' && phase !== 'success' && phase !== 'error' && (
          <TouchableOpacity onPress={resetToStart} style={styles.headerButton}>
            <MaterialIcons name="restart-alt" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {(phase === 'type_select' || phase === 'success' || phase === 'error') && (
          <View style={styles.headerButton} />
        )}
      </View>

      {/* Ride context bar */}
      <View style={styles.contextBar}>
        <Text style={styles.contextText}>{ride.name} — {ride.date}</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {phase === 'type_select' && renderTypeSelection()}
        {phase === 'stage_select' && renderStageSelection()}
        {phase === 'scanning' && renderScanner()}
        {phase === 'manual_entry' && renderManualEntry()}
        {phase === 'confirming' && renderConfirmation()}
        {phase === 'success' && renderSuccess()}
        {phase === 'error' && renderError()}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  contextBar: {
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contextText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    padding: 16,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  // Type selection
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeButtonText: {
    flex: 1,
    marginLeft: 12,
  },
  typeButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  typeButtonSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Scanner
  scannerContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 350,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QR_SCANNER_COLORS.overlay,
  },
  scannerFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: QR_SCANNER_COLORS.frame,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerFooter: {
    padding: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  scanHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  manualEntryLink: {
    marginTop: 8,
  },
  manualEntryLinkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Permission
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Manual entry
  manualInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  manualInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  manualSubmitButton: {
    paddingHorizontal: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },

  // Confirmation
  confirmCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  confirmLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  confirmButtons: {
    gap: 12,
  },

  // Result
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  errorResultText: {
    fontSize: 15,
    color: COLORS.danger,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Buttons
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: COLORS.gray[100],
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
