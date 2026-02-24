import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (locationName: string) => void;
};

const DEFAULT_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type SearchResult = {
  name: string;
  lat: number;
  lon: number;
};

const buildName = (item: any): string => {
  const addr = item.address || {};
  const parts: string[] = [];
  if (item.name) parts.push(item.name);
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
  if (city && city !== item.name) parts.push(city);
  if (addr.country) parts.push(addr.country);
  return parts.length > 0 ? parts.join(', ') : item.display_name;
};

const LocationPickerModal: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [markerCoords, setMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowResults(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim() || text.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'AMOT-BillApp' } }
        );
        const data = await res.json();
        setSearchResults(data.map((item: any) => ({
          name: buildName(item),
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        })));
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  const handleUseCurrentLocation = async () => {
    Keyboard.dismiss();
    setShowResults(false);
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this feature.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const coords = { latitude, longitude };
      setMarkerCoords(coords);
      setSelectedName(null);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 400);
      setIsReverseGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'AMOT-BillApp' } }
        );
        const data = await res.json();
        setSelectedName(buildName(data));
        setSearchQuery(buildName(data));
      } catch {
        setSelectedName(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } finally {
        setIsReverseGeocoding(false);
      }
    } catch {
      Alert.alert('Error', 'Could not get your current location. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    const coords = { latitude: result.lat, longitude: result.lon };
    const newRegion = { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 };
    setMarkerCoords(coords);
    setSelectedName(result.name);
    setSearchQuery(result.name);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(newRegion, 400);
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    setSelectedName(null);
    setShowResults(false);
    Keyboard.dismiss();
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'AMOT-BillApp' } }
      );
      const data = await res.json();
      setSelectedName(buildName(data));
    } catch {
      setSelectedName(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleConfirm = () => {
    if (selectedName) {
      onSelect(selectedName);
      handleClose();
    }
  };

  const handleClose = () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setMarkerCoords(null);
    setSelectedName(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setIsLocating(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick Location</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.confirmBtn, (!selectedName || isReverseGeocoding) && styles.confirmBtnDisabled]}
            disabled={!selectedName || isReverseGeocoding}
          >
            <Text style={[styles.confirmText, (!selectedName || isReverseGeocoding) && styles.confirmTextDisabled]}>
              Confirm
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.gray500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place..."
            placeholderTextColor={COLORS.gray400}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
              <MaterialCommunityIcons name="close" size={18} color={COLORS.gray500} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Use current location */}
        <TouchableOpacity
          style={styles.currentLocationRow}
          onPress={handleUseCurrentLocation}
          disabled={isLocating || isReverseGeocoding}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.primary} />
          )}
          <Text style={styles.currentLocationText}>
            {isLocating ? 'Getting your location...' : 'Use current location'}
          </Text>
        </TouchableOpacity>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.resultItem, index < searchResults.length - 1 && styles.resultItemBorder]}
                onPress={() => handleSelectResult(result)}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={COLORS.gray500} style={{ marginTop: 2 }} />
                <Text style={styles.resultText} numberOfLines={2}>{result.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          onPress={handleMapPress}
          onLongPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {markerCoords && (
            <Marker coordinate={markerCoords} />
          )}
        </MapView>

        {/* Selected location banner */}
        {(selectedName || isReverseGeocoding) && (
          <View style={styles.selectedBanner}>
            {isReverseGeocoding ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <MaterialCommunityIcons name="map-marker-check" size={16} color="#16a34a" />
            )}
            <Text style={styles.selectedBannerText} numberOfLines={1}>
              {isReverseGeocoding ? 'Getting location name...' : selectedName}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.black,
  },
  headerBtn: {
    padding: SPACING.sm,
  },
  confirmBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
  },
  confirmBtnDisabled: {
    backgroundColor: COLORS.gray200,
  },
  confirmText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  confirmTextDisabled: {
    color: COLORS.gray400,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.black,
    paddingVertical: SPACING.sm,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  currentLocationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  resultsContainer: {
    position: 'absolute',
    top: 165,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    zIndex: 100,
    elevation: 6,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  resultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  resultText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
  },
  map: {
    flex: 1,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#f0fdf4',
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  selectedBannerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: '#166534',
    fontWeight: '500',
  },
});

export default LocationPickerModal;
