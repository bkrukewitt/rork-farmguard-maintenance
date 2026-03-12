import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  X,
  FileText,
  Fuel,
  ChevronRight,
  ChevronDown,
  Check,
  Share2,
  Mail,
  Calendar,
  Download,
  Eye,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useFarmData } from '@/contexts/FarmDataContext';
import { supabase } from '@/lib/supabase';
import { Equipment, MaintenanceLog, FuelLog, Consumable } from '@/types/equipment';
import {
  generateMaintenancePdf,
  generateFuelPdf,
  generateFuelExcel,
  createZipFromFiles,
  shareFile,
  emailFile,
  getDateRangeForPreset,
  getExportFileName,
  filterLogsByDateRange,
  GeneratePdfOptions,
} from '@/utils/exportHelpers';
import { generateMaintenancePdfHtml, generateFuelOnlyPdfHtml, sanitizeFileName } from '@/utils/pdfTemplate';

type ExportMode = 'maintenance' | 'fuel';
type DatePreset = 'ytd' | 'last12' | 'alltime' | 'custom';
type FuelFormat = 'pdf' | 'excel';
type BatchMode = 'combined' | 'separate';
type FuelSheetMode = 'combined' | 'separate';

interface ExportRecordsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function ExportRecordsModal({ visible, onDismiss }: ExportRecordsModalProps) {
  const { colors, currentScheme } = useTheme();
  const { equipment, maintenanceLogs, fuelLogs, consumables, farmId } = useFarmData();

  // Step tracking
  const [step, setStep] = useState<'mode' | 'options' | 'preview'>('mode');

  // Export mode
  const [exportMode, setExportMode] = useState<ExportMode>('maintenance');

  // Equipment selection
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);

  // Date range
  const [datePreset, setDatePreset] = useState<DatePreset>('ytd');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), 0, 1));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Maintenance options
  const [includeFuel, setIncludeFuel] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [batchMode, setBatchMode] = useState<BatchMode>('combined');

  // Fuel options
  const [fuelFormat, setFuelFormat] = useState<FuelFormat>('pdf');
  const [fuelSheetMode, setFuelSheetMode] = useState<FuelSheetMode>('combined');

  // State
  const [isExporting, setIsExporting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const allEquipmentSelected = selectedEquipmentIds.length === equipment.length;

  const allDates = useMemo(() => {
    const dates: string[] = [];
    maintenanceLogs.forEach((l) => dates.push(l.date));
    fuelLogs.forEach((l) => dates.push(l.date));
    return dates;
  }, [maintenanceLogs, fuelLogs]);

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      const start = customStartDate.toISOString().split('T')[0];
      const end = customEndDate.toISOString().split('T')[0];
      const formatDate = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return { start, end, label: `${formatDate(customStartDate)} – ${formatDate(customEndDate)}` };
    }
    return getDateRangeForPreset(datePreset, allDates);
  }, [datePreset, customStartDate, customEndDate, allDates]);

  const selectedEquipment = useMemo(
    () => equipment.filter((e) => selectedEquipmentIds.includes(e.id)),
    [equipment, selectedEquipmentIds],
  );

  const recordCount = useMemo(() => {
    const eqIds = selectedEquipmentIds.length > 0 ? selectedEquipmentIds : equipment.map((e) => e.id);
    const mLogs = filterLogsByDateRange(
      maintenanceLogs.filter((l) => eqIds.includes(l.equipmentId)),
      dateRange.start,
      dateRange.end,
    );
    const fLogs = filterLogsByDateRange(
      fuelLogs.filter((l) => eqIds.includes(l.equipmentId)),
      dateRange.start,
      dateRange.end,
    );
    return { maintenance: mLogs.length, fuel: fLogs.length };
  }, [selectedEquipmentIds, equipment, maintenanceLogs, fuelLogs, dateRange]);

  const resetState = useCallback(() => {
    setStep('mode');
    setExportMode('maintenance');
    setSelectedEquipmentIds([]);
    setShowEquipmentPicker(false);
    setDatePreset('ytd');
    setCustomStartDate(new Date(new Date().getFullYear(), 0, 1));
    setCustomEndDate(new Date());
    setShowStartPicker(false);
    setShowEndPicker(false);
    setIncludeFuel(false);
    setIncludeNotes(true);
    setIncludeAttachments(true);
    setBatchMode('combined');
    setFuelFormat('pdf');
    setFuelSheetMode('combined');
    setIsExporting(false);
    setPreviewHtml(null);
  }, []);

  const handleDismiss = useCallback(() => {
    resetState();
    onDismiss();
  }, [resetState, onDismiss]);

  const toggleEquipment = (id: string) => {
    setSelectedEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAllEquipment = () => {
    if (allEquipmentSelected) {
      setSelectedEquipmentIds([]);
    } else {
      setSelectedEquipmentIds(equipment.map((e) => e.id));
    }
  };

  const getTargetEquipment = (): Equipment[] => {
    if (selectedEquipmentIds.length === 0) return equipment;
    return selectedEquipment;
  };

  const handleStartDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (date) setCustomStartDate(date);
  };

  const handleEndDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (date) setCustomEndDate(date);
  };

  const handlePreview = async () => {
    try {
      setIsExporting(true);
      const targetEquip = getTargetEquipment();
      const eqIds = targetEquip.map((e) => e.id);
      const generationDate = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });

      let html: string;
      if (exportMode === 'fuel') {
        const filteredFuel = filterLogsByDateRange(
          fuelLogs.filter((l) => eqIds.includes(l.equipmentId)),
          dateRange.start, dateRange.end,
        );
        html = generateFuelOnlyPdfHtml({
          equipment: targetEquip, fuelLogs: filteredFuel,
          colorScheme: currentScheme, dateRange, generationDate,
        });
      } else {
        const filteredMaint = filterLogsByDateRange(
          maintenanceLogs.filter((l) => eqIds.includes(l.equipmentId)),
          dateRange.start, dateRange.end,
        );
        const filteredFuel = includeFuel
          ? filterLogsByDateRange(
              fuelLogs.filter((l) => eqIds.includes(l.equipmentId)),
              dateRange.start, dateRange.end,
            )
          : [];
        let farmDisplayName: string | null | undefined;
        if (farmId) {
          try {
            const { data } = await supabase
              .from('farms')
              .select('display_name')
              .eq('id', farmId)
              .maybeSingle();
            farmDisplayName = data?.display_name ?? null;
          } catch {
            farmDisplayName = undefined;
          }
        }

        html = generateMaintenancePdfHtml({
          equipment: targetEquip, maintenanceLogs: filteredMaint,
          fuelLogs: filteredFuel, consumables, colorScheme: currentScheme,
          dateRange, includeFuel, includeNotes, includeAttachments,
          isBatchSummary: targetEquip.length > 1, generationDate,
          farmId,
          farmDisplayName,
        });
      }
      setPreviewHtml(html);
      setStep('preview');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate preview. Please try again.');
      console.error('Preview error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async (method: 'share' | 'email') => {
    try {
      setIsExporting(true);
      const targetEquip = getTargetEquipment();
      const equipNames = targetEquip.map((e) => e.name);

      if (exportMode === 'fuel') {
        if (fuelFormat === 'excel') {
          const uri = await generateFuelExcel({
            equipment: targetEquip, fuelLogs, dateRange,
            separateSheets: fuelSheetMode === 'separate',
          });
          const fileName = getExportFileName({
            equipmentNames: equipNames, exportType: 'fuel',
            dateRangeLabel: dateRange.label, extension: 'xlsx',
          });
          if (method === 'email') {
            await emailFile(uri, fileName, `FarmGuard Fuel Report - ${dateRange.label}`);
          } else {
            await shareFile(uri, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          }
        } else {
          const uri = await generateFuelPdf({
            equipment: targetEquip, fuelLogs,
            colorScheme: currentScheme, dateRange,
          });
          const fileName = getExportFileName({
            equipmentNames: equipNames, exportType: 'fuel',
            dateRangeLabel: dateRange.label, extension: 'pdf',
          });
          if (method === 'email') {
            await emailFile(uri, fileName, `FarmGuard Fuel Report - ${dateRange.label}`);
          } else {
            await shareFile(uri, 'application/pdf');
          }
        }
      } else {
        if (batchMode === 'separate' && targetEquip.length > 1) {
          const files: { name: string; uri: string }[] = [];
          for (const equip of targetEquip) {
            const uri = await generateMaintenancePdf({
              equipment: [equip], maintenanceLogs, fuelLogs, consumables,
              colorScheme: currentScheme, dateRange, includeFuel,
              includeNotes, includeAttachments, isBatchSummary: false,
              farmId,
            });
            const name = getExportFileName({
              equipmentNames: [equip.name], exportType: 'maintenance',
              dateRangeLabel: dateRange.label, extension: 'pdf',
            });
            files.push({ name, uri });
          }
          const zipUri = await createZipFromFiles(files);
          const zipName = getExportFileName({
            equipmentNames: equipNames, exportType: 'maintenance',
            dateRangeLabel: dateRange.label, extension: 'zip',
          });
          if (method === 'email') {
            await emailFile(zipUri, zipName, `FarmGuard Maintenance Reports - ${dateRange.label}`);
          } else {
            await shareFile(zipUri, 'application/zip');
          }
        } else {
          const uri = await generateMaintenancePdf({
            equipment: targetEquip, maintenanceLogs, fuelLogs, consumables,
            colorScheme: currentScheme, dateRange, includeFuel,
            includeNotes, includeAttachments,
            isBatchSummary: targetEquip.length > 1,
            farmId,
          });
          const fileName = getExportFileName({
            equipmentNames: equipNames, exportType: 'maintenance',
            dateRangeLabel: dateRange.label, extension: 'pdf',
          });
          if (method === 'email') {
            await emailFile(uri, fileName, `FarmGuard Maintenance Report - ${dateRange.label}`);
          } else {
            await shareFile(uri, 'application/pdf');
          }
        }
      }
      Alert.alert('Success', 'Export completed successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to export. Please try again.');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const renderModeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>What would you like to export?</Text>

      <TouchableOpacity
        style={[
          styles.modeCard,
          { backgroundColor: colors.surface, borderColor: exportMode === 'maintenance' ? colors.primary : colors.border },
          exportMode === 'maintenance' && { borderWidth: 2 },
        ]}
        onPress={() => setExportMode('maintenance')}
      >
        <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15' }]}>
          <FileText color={colors.primary} size={24} />
        </View>
        <View style={styles.modeContent}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>Maintenance Records</Text>
          <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
            Service history, parts used, and notes
          </Text>
        </View>
        {exportMode === 'maintenance' && <Check color={colors.primary} size={20} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeCard,
          { backgroundColor: colors.surface, borderColor: exportMode === 'fuel' ? colors.primary : colors.border },
          exportMode === 'fuel' && { borderWidth: 2 },
        ]}
        onPress={() => setExportMode('fuel')}
      >
        <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15' }]}>
          <Fuel color={colors.primary} size={24} />
        </View>
        <View style={styles.modeContent}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>Fuel Usage</Text>
          <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
            Fuel fill-ups, DEF tracking, and usage totals
          </Text>
        </View>
        {exportMode === 'fuel' && <Check color={colors.primary} size={20} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={() => setStep('options')}
      >
        <Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Continue</Text>
        <ChevronRight color={colors.textOnPrimary} size={18} />
      </TouchableOpacity>
    </View>
  );

  const renderOptionsStep = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      {/* Equipment Selection */}
      <View style={styles.optionSection}>
        <Text style={[styles.optionSectionTitle, { color: colors.text }]}>Equipment</Text>
        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowEquipmentPicker(!showEquipmentPicker)}
        >
          <Text style={[styles.optionLabel, { color: colors.text }]}>
            {selectedEquipmentIds.length === 0
              ? 'All Equipment'
              : selectedEquipmentIds.length === 1
                ? selectedEquipment[0]?.name
                : `${selectedEquipmentIds.length} Selected`}
          </Text>
          <ChevronDown color={colors.textSecondary} size={18} />
        </TouchableOpacity>

        {showEquipmentPicker && (
          <View style={[styles.equipmentList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.equipmentItem} onPress={toggleAllEquipment}>
              <View style={[
                styles.checkbox,
                { borderColor: colors.border },
                (allEquipmentSelected || selectedEquipmentIds.length === 0) && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}>
                {(allEquipmentSelected || selectedEquipmentIds.length === 0) && (
                  <Check color="#FFF" size={14} />
                )}
              </View>
              <Text style={[styles.equipmentItemText, { color: colors.text, fontWeight: '600' }]}>
                All Equipment
              </Text>
            </TouchableOpacity>
            {equipment.map((equip) => (
              <TouchableOpacity
                key={equip.id}
                style={styles.equipmentItem}
                onPress={() => toggleEquipment(equip.id)}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.border },
                  selectedEquipmentIds.includes(equip.id) && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}>
                  {selectedEquipmentIds.includes(equip.id) && <Check color="#FFF" size={14} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.equipmentItemText, { color: colors.text }]}>{equip.name}</Text>
                  <Text style={[styles.equipmentItemSub, { color: colors.textSecondary }]}>
                    {equip.make} {equip.model} {equip.year ? `(${equip.year})` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Date Range */}
      <View style={styles.optionSection}>
        <Text style={[styles.optionSectionTitle, { color: colors.text }]}>Date Range</Text>
        <View style={styles.presetRow}>
          {(['ytd', 'last12', 'alltime', 'custom'] as DatePreset[]).map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetChip,
                { borderColor: datePreset === preset ? colors.primary : colors.border },
                datePreset === preset && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setDatePreset(preset)}
            >
              <Text style={[
                styles.presetChipText,
                { color: datePreset === preset ? colors.primary : colors.textSecondary },
              ]}>
                {preset === 'ytd' ? 'Year to Date' : preset === 'last12' ? 'Last 12 Mo' : preset === 'alltime' ? 'All Time' : 'Custom'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {datePreset === 'custom' && (
          <View style={styles.datePickerRow}>
            <View style={styles.datePickerCol}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Start</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Calendar color={colors.textSecondary} size={16} />
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  {customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={customStartDate}
                  mode="date"
                  display="default"
                  onChange={handleStartDateChange}
                  maximumDate={customEndDate}
                />
              )}
            </View>
            <View style={styles.datePickerCol}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>End</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Calendar color={colors.textSecondary} size={16} />
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  {customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={customEndDate}
                  mode="date"
                  display="default"
                  onChange={handleEndDateChange}
                  minimumDate={customStartDate}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>
        )}

        <Text style={[styles.dateRangeLabel, { color: colors.textSecondary }]}>
          {dateRange.label}
        </Text>
      </View>

      {/* Maintenance-specific options */}
      {exportMode === 'maintenance' && (
        <View style={styles.optionSection}>
          <Text style={[styles.optionSectionTitle, { color: colors.text }]}>Include</Text>

          <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Fuel Records</Text>
            <Switch
              value={includeFuel}
              onValueChange={setIncludeFuel}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={includeFuel ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Notes</Text>
            <Switch
              value={includeNotes}
              onValueChange={setIncludeNotes}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={includeNotes ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Attachment Names</Text>
            <Switch
              value={includeAttachments}
              onValueChange={setIncludeAttachments}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={includeAttachments ? colors.primary : colors.textSecondary}
            />
          </View>

          {(selectedEquipmentIds.length === 0 || selectedEquipmentIds.length > 1) && (
            <View style={styles.batchSection}>
              <Text style={[styles.optionSubTitle, { color: colors.text }]}>Batch Export Format</Text>
              <View style={styles.batchRow}>
                <TouchableOpacity
                  style={[
                    styles.batchOption,
                    { borderColor: batchMode === 'combined' ? colors.primary : colors.border },
                    batchMode === 'combined' && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => setBatchMode('combined')}
                >
                  <Text style={[styles.batchOptionTitle, { color: batchMode === 'combined' ? colors.primary : colors.text }]}>
                    Combined PDF
                  </Text>
                  <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                    One file, all equipment
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.batchOption,
                    { borderColor: batchMode === 'separate' ? colors.primary : colors.border },
                    batchMode === 'separate' && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => setBatchMode('separate')}
                >
                  <Text style={[styles.batchOptionTitle, { color: batchMode === 'separate' ? colors.primary : colors.text }]}>
                    Separate PDFs
                  </Text>
                  <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                    Zipped individual files
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Fuel-specific options */}
      {exportMode === 'fuel' && (
        <View style={styles.optionSection}>
          <Text style={[styles.optionSectionTitle, { color: colors.text }]}>Format</Text>
          <View style={styles.batchRow}>
            <TouchableOpacity
              style={[
                styles.batchOption,
                { borderColor: fuelFormat === 'pdf' ? colors.primary : colors.border },
                fuelFormat === 'pdf' && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setFuelFormat('pdf')}
            >
              <Text style={[styles.batchOptionTitle, { color: fuelFormat === 'pdf' ? colors.primary : colors.text }]}>
                PDF
              </Text>
              <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                Branded report
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.batchOption,
                { borderColor: fuelFormat === 'excel' ? colors.primary : colors.border },
                fuelFormat === 'excel' && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setFuelFormat('excel')}
            >
              <Text style={[styles.batchOptionTitle, { color: fuelFormat === 'excel' ? colors.primary : colors.text }]}>
                Excel
              </Text>
              <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                Spreadsheet data
              </Text>
            </TouchableOpacity>
          </View>

          {fuelFormat === 'excel' && (selectedEquipmentIds.length === 0 || selectedEquipmentIds.length > 1) && (
            <View style={styles.batchSection}>
              <Text style={[styles.optionSubTitle, { color: colors.text }]}>Sheet Layout</Text>
              <View style={styles.batchRow}>
                <TouchableOpacity
                  style={[
                    styles.batchOption,
                    { borderColor: fuelSheetMode === 'combined' ? colors.primary : colors.border },
                    fuelSheetMode === 'combined' && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => setFuelSheetMode('combined')}
                >
                  <Text style={[styles.batchOptionTitle, { color: fuelSheetMode === 'combined' ? colors.primary : colors.text }]}>
                    Combined
                  </Text>
                  <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                    All on one sheet
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.batchOption,
                    { borderColor: fuelSheetMode === 'separate' ? colors.primary : colors.border },
                    fuelSheetMode === 'separate' && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => setFuelSheetMode('separate')}
                >
                  <Text style={[styles.batchOptionTitle, { color: fuelSheetMode === 'separate' ? colors.primary : colors.text }]}>
                    Separate Sheets
                  </Text>
                  <Text style={[styles.batchOptionDesc, { color: colors.textSecondary }]}>
                    One per equipment
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Export Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Equipment</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {selectedEquipmentIds.length === 0 ? `All (${equipment.length})` : selectedEquipmentIds.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Date Range</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{dateRange.label}</Text>
        </View>
        {exportMode === 'maintenance' && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Maintenance Records</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{recordCount.maintenance}</Text>
          </View>
        )}
        {(exportMode === 'fuel' || (exportMode === 'maintenance' && includeFuel)) && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Fuel Records</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{recordCount.fuel}</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={handlePreview}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Eye color={colors.primary} size={18} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Preview</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => handleExport('share')}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Share2 color={colors.textOnPrimary} size={18} />
              <Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Save / Share</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={() => handleExport('email')}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Mail color={colors.primary} size={18} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Email</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderPreviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Preview</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        This is a preview of your export. Use the buttons below to save or share.
      </Text>

      <View style={[styles.previewContainer, { borderColor: colors.border }]}>
        {previewHtml ? (
          <ScrollView style={styles.previewScroll} nestedScrollEnabled>
            <View style={styles.previewContent}>
              <Text style={[styles.previewPlaceholder, { color: colors.textSecondary }]}>
                Preview generated. Tap "Save / Share" to export as PDF, or "Email" to send.
              </Text>
              <View style={[styles.previewStats, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.previewStatsText, { color: colors.primary }]}>
                  {exportMode === 'maintenance'
                    ? `${recordCount.maintenance} maintenance records${includeFuel ? ` + ${recordCount.fuel} fuel records` : ''}`
                    : `${recordCount.fuel} fuel records`}
                </Text>
                <Text style={[styles.previewStatsText, { color: colors.primary }]}>
                  {selectedEquipmentIds.length === 0 ? `${equipment.length} equipment` : `${selectedEquipmentIds.length} equipment`}
                </Text>
                <Text style={[styles.previewStatsText, { color: colors.primary }]}>
                  {dateRange.label}
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => handleExport('share')}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Share2 color={colors.textOnPrimary} size={18} />
              <Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Save / Share</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={() => handleExport('email')}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Mail color={colors.primary} size={18} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Email</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {step !== 'mode' ? (
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => setStep(step === 'preview' ? 'options' : 'mode')}
            >
              <ChevronRight
                color={colors.text}
                size={22}
                style={{ transform: [{ rotate: '180deg' }] }}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBackButton} />
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>Export Records</Text>
          <TouchableOpacity style={styles.headerCloseButton} onPress={handleDismiss}>
            <X color={colors.text} size={22} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {step === 'mode' && renderModeStep()}
        {step === 'options' && renderOptionsStep()}
        {step === 'preview' && renderPreviewStep()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeDescription: {
    fontSize: 13,
  },
  optionSection: {
    marginBottom: 24,
  },
  optionSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  optionSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionLabel: {
    fontSize: 15,
  },
  equipmentList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    maxHeight: 280,
    overflow: 'hidden',
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentItemText: {
    fontSize: 15,
  },
  equipmentItemSub: {
    fontSize: 12,
    marginTop: 1,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  datePickerCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 14,
  },
  dateRangeLabel: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 15,
  },
  batchSection: {
    marginTop: 12,
  },
  batchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  batchOption: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  batchOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  batchOptionDesc: {
    fontSize: 12,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  previewPlaceholder: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  previewStats: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  previewStatsText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
