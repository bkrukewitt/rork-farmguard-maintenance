import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Tractor,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { parseEquipmentCSV, ParsedEquipment } from '@/utils/csvHelpers';
import { EQUIPMENT_TYPES, EquipmentType } from '@/types/equipment';

export default function ImportEquipmentScreen() {
  const router = useRouter();
  const { bulkAddEquipment } = useFarmData();
  
  const [parsedData, setParsedData] = useState<ParsedEquipment[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);

  const handlePickFile = async () => {
    try {
      setIsParsing(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', result);

      if (result.canceled) {
        setIsParsing(false);
        return;
      }

      const file = result.assets[0];
      setFileName(file.name);

      let content: string;
      
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri);
      }

      console.log('File content length:', content.length);
      console.log('File content preview:', content.substring(0, 500));

      const parseResult = parseEquipmentCSV(content);
      setParsedData(parseResult.data);
      setParseErrors(parseResult.errors);

      if (!parseResult.success && parseResult.data.length === 0) {
        Alert.alert('Parse Error', parseResult.errors.join('\n'));
      }
    } catch (error) {
      console.log('Error picking file:', error);
      Alert.alert('Error', 'Failed to read the file. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validEquipment = parsedData.filter(e => e.isValid);
      if (validEquipment.length === 0) {
        throw new Error('No valid equipment to import');
      }

      const equipmentToImport = validEquipment.map(e => ({
        name: e.name,
        type: e.type,
        make: e.make,
        model: e.model,
        year: e.year,
        serialNumber: e.serialNumber,
        purchaseDate: e.purchaseDate,
        currentHours: e.currentHours,
        warrantyExpiry: e.warrantyExpiry,
        notes: e.notes,
      }));

      await bulkAddEquipment(equipmentToImport);
      return validEquipment.length;
    },
    onSuccess: (count) => {
      Alert.alert(
        'Import Successful',
        `Successfully imported ${count} piece${count > 1 ? 's' : ''} of equipment.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: Error) => {
      Alert.alert('Import Failed', error.message);
    },
  });

  const handleImport = () => {
    const validCount = parsedData.filter(e => e.isValid).length;
    if (validCount === 0) {
      Alert.alert('No Valid Equipment', 'Please fix the errors before importing.');
      return;
    }

    Alert.alert(
      'Confirm Import',
      `Import ${validCount} piece${validCount > 1 ? 's' : ''} of equipment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: () => importMutation.mutate() },
      ]
    );
  };

  const getTypeLabel = (type: EquipmentType) => {
    return EQUIPMENT_TYPES.find(t => t.value === type)?.label ?? type;
  };

  const validCount = parsedData.filter(e => e.isValid).length;
  const invalidCount = parsedData.filter(e => !e.isValid).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Import Equipment' }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <Tractor color={Colors.primary} size={48} />
          </View>
          <Text style={styles.uploadTitle}>Import Equipment from CSV</Text>
          <Text style={styles.uploadDescription}>
            Select a CSV file to bulk import equipment into your fleet. 
            The file should have columns for Name, Type, Make, Model, etc.
          </Text>
          
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickFile}
            disabled={isParsing}
          >
            {isParsing ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Upload color={Colors.textOnPrimary} size={20} />
                <Text style={styles.uploadButtonText}>
                  {fileName ? 'Select Different File' : 'Select CSV File'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {fileName && (
          <View style={styles.fileInfo}>
            <FileSpreadsheet color={Colors.textSecondary} size={20} />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          </View>
        )}

        {parseErrors.length > 0 && (
          <View style={styles.warningsSection}>
            <View style={styles.warningsHeader}>
              <AlertCircle color={Colors.warning} size={20} />
              <Text style={styles.warningsTitle}>Warnings</Text>
            </View>
            {parseErrors.slice(0, 5).map((error, index) => (
              <Text key={index} style={styles.warningText}>{error}</Text>
            ))}
            {parseErrors.length > 5 && (
              <Text style={styles.warningMore}>
                +{parseErrors.length - 5} more warnings
              </Text>
            )}
          </View>
        )}

        {parsedData.length > 0 && (
          <>
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Import Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryBadge, styles.summaryBadgeSuccess]}>
                    <CheckCircle color={Colors.success} size={16} />
                  </View>
                  <Text style={styles.summaryValue}>{validCount}</Text>
                  <Text style={styles.summaryLabel}>Valid</Text>
                </View>
                {invalidCount > 0 && (
                  <View style={styles.summaryItem}>
                    <View style={[styles.summaryBadge, styles.summaryBadgeDanger]}>
                      <X color={Colors.danger} size={16} />
                    </View>
                    <Text style={[styles.summaryValue, styles.summaryValueDanger]}>
                      {invalidCount}
                    </Text>
                    <Text style={styles.summaryLabel}>Invalid</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Preview ({parsedData.length} rows)</Text>
              
              {parsedData.slice(0, 10).map((eq, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.previewItem,
                    !eq.isValid && styles.previewItemInvalid,
                  ]}
                >
                  <View style={styles.previewHeader}>
                    <View style={styles.previewStatus}>
                      {eq.isValid ? (
                        <CheckCircle color={Colors.success} size={16} />
                      ) : (
                        <AlertCircle color={Colors.danger} size={16} />
                      )}
                    </View>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{eq.name || '(No name)'}</Text>
                      <Text style={styles.previewSubtitle}>
                        {eq.year} {eq.make} {eq.model}
                      </Text>
                    </View>
                    <ChevronRight color={Colors.textSecondary} size={16} />
                  </View>
                  
                  <View style={styles.previewDetails}>
                    <View style={styles.previewDetailRow}>
                      <Text style={styles.previewDetailLabel}>Type</Text>
                      <Text style={styles.previewDetailValue}>
                        {getTypeLabel(eq.type)}
                      </Text>
                    </View>
                    <View style={styles.previewDetailRow}>
                      <Text style={styles.previewDetailLabel}>Hours</Text>
                      <Text style={styles.previewDetailValue}>{eq.currentHours}</Text>
                    </View>
                    {eq.serialNumber && (
                      <View style={styles.previewDetailRow}>
                        <Text style={styles.previewDetailLabel}>Serial</Text>
                        <Text style={styles.previewDetailValue}>{eq.serialNumber}</Text>
                      </View>
                    )}
                  </View>
                  
                  {!eq.isValid && eq.validationError && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{eq.validationError}</Text>
                    </View>
                  )}
                </View>
              ))}
              
              {parsedData.length > 10 && (
                <Text style={styles.moreItemsText}>
                  +{parsedData.length - 10} more items
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {parsedData.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.importButton,
              (validCount === 0 || importMutation.isPending) && styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={validCount === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <ActivityIndicator color={Colors.textOnPrimary} size="small" />
            ) : (
              <>
                <Check color={Colors.textOnPrimary} size={20} />
                <Text style={styles.importButtonText}>
                  Import {validCount} Item{validCount !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  uploadSection: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  warningsSection: {
    backgroundColor: Colors.warning + '10',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  warningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warningsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  warningText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  warningMore: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500' as const,
    marginTop: 8,
  },
  summarySection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryBadgeSuccess: {
    backgroundColor: Colors.success + '15',
  },
  summaryBadgeDanger: {
    backgroundColor: Colors.danger + '15',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  summaryValueDanger: {
    color: Colors.danger,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  previewSection: {
    marginTop: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  previewItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewItemInvalid: {
    borderColor: Colors.danger + '50',
    backgroundColor: Colors.danger + '05',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewStatus: {
    marginRight: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  previewSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewDetails: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  previewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewDetailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  previewDetailValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  errorBanner: {
    backgroundColor: Colors.danger + '15',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  moreItemsText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  importButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
});
