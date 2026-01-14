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
  Merge,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { parseCSV, ParsedPart } from '@/utils/csvHelpers';
import { CONSUMABLE_CATEGORIES, ConsumableCategory } from '@/types/equipment';

interface ProcessedPart extends ParsedPart {
  matchedEquipmentIds: string[];
  unmatchedEquipment: string[];
  mergedFrom?: number[];
}

export default function ImportInventoryScreen() {
  const router = useRouter();
  const { bulkAddConsumables, equipment } = useFarmData();
  
  const [parsedData, setParsedData] = useState<ProcessedPart[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);

  const matchEquipmentByName = (equipmentNames: string[]): { matched: string[]; unmatched: string[] } => {
    const matched: string[] = [];
    const unmatched: string[] = [];
    
    equipmentNames.forEach(name => {
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName) return;
      
      const found = equipment.find(e => 
        e.name.toLowerCase() === trimmedName ||
        e.name.toLowerCase().includes(trimmedName) ||
        trimmedName.includes(e.name.toLowerCase())
      );
      
      if (found) {
        if (!matched.includes(found.id)) {
          matched.push(found.id);
        }
      } else {
        unmatched.push(name.trim());
      }
    });
    
    return { matched, unmatched };
  };

  const mergeDuplicateParts = (parts: ParsedPart[]): ProcessedPart[] => {
    const partMap = new Map<string, ProcessedPart>();
    
    parts.forEach((part, index) => {
      const partNumberKey = part.partNumber.toLowerCase().trim();
      
      const equipmentNames = part.equipment 
        ? part.equipment.split(',').map(e => e.trim()).filter(e => e)
        : [];
      const { matched, unmatched } = matchEquipmentByName(equipmentNames);
      
      if (partMap.has(partNumberKey)) {
        const existing = partMap.get(partNumberKey)!;
        
        matched.forEach(id => {
          if (!existing.matchedEquipmentIds.includes(id)) {
            existing.matchedEquipmentIds.push(id);
          }
        });
        
        unmatched.forEach(name => {
          if (!existing.unmatchedEquipment.includes(name)) {
            existing.unmatchedEquipment.push(name);
          }
        });
        
        existing.quantity += part.quantity;
        
        if (!existing.mergedFrom) {
          existing.mergedFrom = [existing.rowNumber];
        }
        existing.mergedFrom.push(part.rowNumber);
        
        if (!existing.supplier && part.supplier) {
          existing.supplier = part.supplier;
        }
        if (!existing.supplierPartNumber && part.supplierPartNumber) {
          existing.supplierPartNumber = part.supplierPartNumber;
        }
        if (!existing.notes && part.notes) {
          existing.notes = part.notes;
        } else if (existing.notes && part.notes && existing.notes !== part.notes) {
          existing.notes = `${existing.notes}; ${part.notes}`;
        }
      } else {
        partMap.set(partNumberKey, {
          ...part,
          matchedEquipmentIds: matched,
          unmatchedEquipment: unmatched,
        });
      }
    });
    
    return Array.from(partMap.values());
  };

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

      const parseResult = parseCSV(content);
      const processedParts = mergeDuplicateParts(parseResult.data);
      
      const mergeWarnings: string[] = [];
      const equipmentWarnings: string[] = [];
      
      processedParts.forEach(part => {
        if (part.mergedFrom && part.mergedFrom.length > 1) {
          mergeWarnings.push(
            `Part #${part.partNumber}: Merged ${part.mergedFrom.length} duplicate rows (rows ${part.mergedFrom.join(', ')})`
          );
        }
        if (part.unmatchedEquipment.length > 0) {
          equipmentWarnings.push(
            `Part #${part.partNumber}: Equipment not found: "${part.unmatchedEquipment.join('", "')}"`
          );
        }
      });
      
      setParsedData(processedParts);
      setParseErrors([...parseResult.errors, ...mergeWarnings, ...equipmentWarnings]);

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
      const validParts = parsedData.filter(p => p.isValid);
      if (validParts.length === 0) {
        throw new Error('No valid parts to import');
      }

      const partsToImport = validParts.map(p => ({
        name: p.name,
        partNumber: p.partNumber,
        category: p.category,
        supplier: p.supplier,
        supplierPartNumber: p.supplierPartNumber,
        quantity: p.quantity,
        lowStockThreshold: p.lowStockThreshold,
        compatibleEquipment: p.matchedEquipmentIds.length > 0 ? p.matchedEquipmentIds : undefined,
        notes: p.notes,
      }));

      await bulkAddConsumables(partsToImport);
      return validParts.length;
    },
    onSuccess: (count) => {
      Alert.alert(
        'Import Successful',
        `Successfully imported ${count} part${count > 1 ? 's' : ''} to your inventory.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: Error) => {
      Alert.alert('Import Failed', error.message);
    },
  });

  const handleImport = () => {
    const validCount = parsedData.filter(p => p.isValid).length;
    if (validCount === 0) {
      Alert.alert('No Valid Parts', 'Please fix the errors before importing.');
      return;
    }

    Alert.alert(
      'Confirm Import',
      `Import ${validCount} part${validCount > 1 ? 's' : ''} to your inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: () => importMutation.mutate() },
      ]
    );
  };

  const getCategoryLabel = (category: ConsumableCategory) => {
    return CONSUMABLE_CATEGORIES.find((c: { value: ConsumableCategory; label: string }) => c.value === category)?.label ?? category;
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.filter(p => !p.isValid).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Import Parts' }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <FileSpreadsheet color={Colors.primary} size={48} />
          </View>
          <Text style={styles.uploadTitle}>Import Parts from CSV</Text>
          <Text style={styles.uploadDescription}>
            Select a CSV file to bulk import parts into your inventory. 
            The file should have columns for Part Name, Part Number, Category, etc.
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
              
              {parsedData.slice(0, 10).map((part, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.previewItem,
                    !part.isValid && styles.previewItemInvalid,
                  ]}
                >
                  <View style={styles.previewHeader}>
                    <View style={styles.previewStatus}>
                      {part.isValid ? (
                        <CheckCircle color={Colors.success} size={16} />
                      ) : (
                        <AlertCircle color={Colors.danger} size={16} />
                      )}
                    </View>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{part.name || '(No name)'}</Text>
                      <Text style={styles.previewPartNumber}>
                        {part.partNumber ? `#${part.partNumber}` : '(No part number)'}
                      </Text>
                    </View>
                    <ChevronRight color={Colors.textSecondary} size={16} />
                  </View>
                  
                  <View style={styles.previewDetails}>
                    <View style={styles.previewDetailRow}>
                      <Text style={styles.previewDetailLabel}>Category</Text>
                      <Text style={styles.previewDetailValue}>
                        {getCategoryLabel(part.category)}
                      </Text>
                    </View>
                    <View style={styles.previewDetailRow}>
                      <Text style={styles.previewDetailLabel}>Quantity</Text>
                      <Text style={styles.previewDetailValue}>{part.quantity}</Text>
                    </View>
                    {part.supplier && (
                      <View style={styles.previewDetailRow}>
                        <Text style={styles.previewDetailLabel}>Supplier</Text>
                        <Text style={styles.previewDetailValue}>{part.supplier}</Text>
                      </View>
                    )}
                    {(part.matchedEquipmentIds.length > 0 || part.unmatchedEquipment.length > 0) && (
                      <View style={styles.previewDetailRow}>
                        <Text style={styles.previewDetailLabel}>Equipment</Text>
                        <View style={styles.equipmentValues}>
                          {part.matchedEquipmentIds.map(eqId => {
                            const eq = equipment.find(e => e.id === eqId);
                            return (
                              <Text key={eqId} style={styles.previewDetailValueSuccess} numberOfLines={1}>
                                {eq?.name ?? 'Unknown'}
                              </Text>
                            );
                          })}
                          {part.unmatchedEquipment.map((name, i) => (
                            <Text key={`unmatched-${i}`} style={styles.previewDetailValueWarning} numberOfLines={1}>
                              {name} (not found)
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                    {part.mergedFrom && part.mergedFrom.length > 1 && (
                      <View style={styles.mergedBadge}>
                        <Merge color={Colors.primary} size={12} />
                        <Text style={styles.mergedText}>
                          Merged from {part.mergedFrom.length} rows
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {!part.isValid && part.validationError && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{part.validationError}</Text>
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
                  Import {validCount} Part{validCount !== 1 ? 's' : ''}
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
  previewPartNumber: {
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
  previewDetailValueSuccess: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500' as const,
  },
  previewDetailValueWarning: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
  equipmentValues: {
    flex: 1,
    alignItems: 'flex-end' as const,
  },
  mergedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
    alignSelf: 'flex-start' as const,
  },
  mergedText: {
    fontSize: 11,
    color: Colors.primary,
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
