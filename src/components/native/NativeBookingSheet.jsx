import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import NativeIcon from './NativeIcon';
import { LightTheme, DarkTheme, Typography, Radii, Shadows } from '../../styles/theme';
import { getLocationUpToFirstComma } from '../../utils/locationCleaner';
import ExpandableBookingForm from './ExpandableBookingForm';

export { default as ExpandableBookingForm } from './ExpandableBookingForm';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const VEHICLE_TYPES = [
  { id: 'hatchback', name: 'Hatchback', baseMultiplier: 1.0 },
  { id: 'sedan', name: 'Sedan', baseMultiplier: 1.1 },
  { id: 'suv', name: 'SUV / 7-Seater', baseMultiplier: 1.25 },
  { id: 'luxury', name: 'Luxury (BMW/Merc)', baseMultiplier: 1.45 },
];

export default function NativeBookingSheet({
  visible = false,
  category = 'hourly',
  initialDestination = '',
  onClose,
  onSubmitBooking,
  isDark = false,
  useExpandableForm = true,
}) {
  const theme = isDark ? DarkTheme : LightTheme;

  const pickupFullRef = useRef('Current Location (GPS)');
  const destFullRef = useRef(initialDestination || '');

  const [pickup, setPickup] = useState('Current Location (GPS)');
  const [destination, setDestination] = useState(initialDestination ? getLocationUpToFirstComma(initialDestination) : '');
  const [selectedVehicle, setSelectedVehicle] = useState('sedan');
  const [transmission, setTransmission] = useState('automatic');
  const [hours, setHours] = useState(4);

  useEffect(() => {
    if (initialDestination) {
      destFullRef.current = initialDestination;
      setDestination(getLocationUpToFirstComma(initialDestination));
    }
  }, [initialDestination]);

  // Compute estimated fare
  const vehicle = VEHICLE_TYPES.find(v => v.id === selectedVehicle) || VEHICLE_TYPES[1];
  const ratePerHour = 250;
  const estimatedFare = Math.round(hours * ratePerHour * vehicle.baseMultiplier);

  const handleConfirm = () => {
    if (onSubmitBooking) {
      onSubmitBooking({
        category,
        pickup: pickupFullRef.current || pickup,
        destination: destFullRef.current || destination,
        vehicleType: selectedVehicle,
        transmission,
        hours,
        estimatedFare,
      });
    }
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.sheetContent, { backgroundColor: theme.card }]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Book a Driver</Text>
              <Text style={[styles.sheetCategory, { color: theme.muted }]}>
                {category.toUpperCase()} SERVICE
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.surface }]}
              onPress={onClose}
            >
              <NativeIcon name="x" size={16} color={theme.ink} />
            </TouchableOpacity>
          </View>

          {useExpandableForm ? (
            <ExpandableBookingForm
              initialPickup={pickup}
              initialDestination={destination}
              category={category}
              isDark={isDark}
              onConfirmBooking={(bookingPayload) => {
                if (onSubmitBooking) onSubmitBooking(bookingPayload);
                if (onClose) onClose();
              }}
              containerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
            />
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
            {/* Location Fields */}
            <View style={[styles.inputGroup, { backgroundColor: theme.field }]}>
              {/* Pickup */}
              <View style={styles.inputRow}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <View style={styles.textInputWrap}>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>PICKUP</Text>
                  <TextInput
                    value={pickup}
                    onChangeText={(val) => {
                      pickupFullRef.current = val;
                      setPickup(val);
                    }}
                    onBlur={() => {
                      if (pickup && pickup.includes(',')) {
                        setPickup(getLocationUpToFirstComma(pickup));
                      }
                    }}
                    style={[styles.input, { color: theme.ink }]}
                    placeholder="Enter pickup address"
                    placeholderTextColor={theme.muted}
                  />
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.line }]} />

              {/* Destination */}
              <View style={styles.inputRow}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <View style={styles.textInputWrap}>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>DESTINATION</Text>
                  <TextInput
                    value={destination}
                    onChangeText={(val) => {
                      destFullRef.current = val;
                      setDestination(val);
                    }}
                    onBlur={() => {
                      if (destination && destination.includes(',')) {
                        setDestination(getLocationUpToFirstComma(destination));
                      }
                    }}
                    style={[styles.input, { color: theme.ink }]}
                    placeholder="Where are you going?"
                    placeholderTextColor={theme.muted}
                  />
                </View>
              </View>
            </View>

            {/* Transmission Selector */}
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>Car Transmission</Text>
            <View style={styles.transmissionRow}>
              {['automatic', 'manual'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.transmissionChip,
                    {
                      backgroundColor: transmission === t ? theme.solid : theme.surface,
                      borderColor: transmission === t ? theme.solid : theme.line,
                    },
                  ]}
                  onPress={() => setTransmission(t)}
                >
                  <Text
                    style={[
                      styles.transmissionText,
                      { color: transmission === t ? theme.onSolid : theme.ink },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vehicle Type Picker */}
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>Your Vehicle Type</Text>
            <View style={styles.vehicleGrid}>
              {VEHICLE_TYPES.map((v) => {
                const isSelected = selectedVehicle === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.vehicleCard,
                      {
                        backgroundColor: isSelected ? theme.yellowSoft : theme.surface,
                        borderColor: isSelected ? theme.yellow : theme.line,
                      },
                    ]}
                    onPress={() => setSelectedVehicle(v.id)}
                  >
                    <NativeIcon name="car" size={20} color={isSelected ? '#000000' : theme.ink} />
                    <Text
                      style={[
                        styles.vehicleName,
                        { color: isSelected ? '#000000' : theme.ink },
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Hours Counter (for hourly) */}
            <View style={[styles.hoursBox, { backgroundColor: theme.surface }]}>
              <View>
                <Text style={[styles.hoursTitle, { color: theme.ink }]}>Duration Required</Text>
                <Text style={[styles.hoursSub, { color: theme.muted }]}>Extra hours billed at ₹250/hr</Text>
              </View>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={[styles.counterBtn, { backgroundColor: theme.card }]}
                  onPress={() => setHours(Math.max(2, hours - 1))}
                >
                  <Text style={[styles.counterBtnText, { color: theme.ink }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.hoursValue, { color: theme.ink }]}>{hours} hrs</Text>
                <TouchableOpacity
                  style={[styles.counterBtn, { backgroundColor: theme.card }]}
                  onPress={() => setHours(Math.min(12, hours + 1))}
                >
                  <Text style={[styles.counterBtnText, { color: theme.ink }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer with Fare & Action */}
          <View style={[styles.sheetFooter, { borderTopColor: theme.line }]}>
            <View>
              <Text style={[styles.fareLabel, { color: theme.muted }]}>Estimated Total</Text>
              <Text style={[styles.fareValue, { color: theme.ink }]}>₹{estimatedFare}</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.solid }]}
              activeOpacity={0.85}
              onPress={handleConfirm}
            >
              <Text style={[styles.confirmButtonText, { color: theme.onSolid }]}>
                Confirm Driver Request
              </Text>
            </TouchableOpacity>

            </View>
          </>
        )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContent: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingTop: 10,
    ...Shadows.floating,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetTitle: {
    ...Typography.title2,
  },
  sheetCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    borderRadius: Radii.md,
    padding: 12,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  textInputWrap: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  transmissionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  transmissionChip: {
    flex: 1,
    height: 40,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transmissionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  vehicleCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    gap: 8,
  },
  vehicleName: {
    fontSize: 12,
    fontWeight: '700',
  },
  hoursBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: Radii.md,
    marginBottom: 20,
  },
  hoursTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  hoursSub: {
    fontSize: 11,
    marginTop: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  counterBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  hoursValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fareLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  confirmButton: {
    paddingHorizontal: 22,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '750',
  },
});
