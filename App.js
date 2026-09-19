import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const STORAGE_PROFILES_KEY = '@rpg_soundboard_profiles_v2';
const STORAGE_ACTIVE_PROFILE_KEY = '@rpg_soundboard_active_profile_v2';

export default function App() {
  const [profiles, setProfiles] = useState([
    { id: 'scene-default', name: 'Taverna', sounds: [] },
  ]);
  const [activeProfileId, setActiveProfileId] = useState('scene-default');
  const [playingMap, setPlayingMap] = useState({});

  // Modais
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);

  // Estados temporários para inputs
  const [pendingFile, setPendingFile] = useState(null);
  const [soundNameInput, setSoundNameInput] = useState('');
  const [profileNameInput, setProfileNameInput] = useState('');

  // Referência para armazenar os players de áudio nativos
  const playersRef = useRef({});

  // Carregar dados salvos ao abrir o app
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedProfilesJson = await AsyncStorage.getItem(STORAGE_PROFILES_KEY);
      const savedActiveId = await AsyncStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY);

      if (savedProfilesJson) {
        const loadedProfiles = JSON.parse(savedProfilesJson);
        if (Array.isArray(loadedProfiles) && loadedProfiles.length > 0) {
          setProfiles(loadedProfiles);
          if (savedActiveId && loadedProfiles.some(p => p.id === savedActiveId)) {
            setActiveProfileId(savedActiveId);
          } else {
            setActiveProfileId(loadedProfiles[0].id);
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados salvos:', e);
    }
  };

  // Salvar perfis sempre que forem alterados
  const persistProfiles = async (newProfiles, newActiveId = activeProfileId) => {
    setProfiles(newProfiles);
    try {
      await AsyncStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(newProfiles));
      if (newActiveId) {
        await AsyncStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, newActiveId);
      }
    } catch (e) {
      console.warn('Erro ao salvar dados:', e);
    }
  };

  const activeProfile =
    profiles.find(p => p.id === activeProfileId) || profiles[0];

  // Copiar arquivo de áudio para a pasta definitiva do aplicativo
  const copyAudioToPermanentStorage = async (file) => {
    try {
      const soundsDir = `${FileSystem.documentDirectory}sounds/`;
      const dirInfo = await FileSystem.getInfoAsync(soundsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(soundsDir, { intermediates: true });
      }

      const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'mp3';
      const permanentFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const destinationUri = `${soundsDir}${permanentFileName}`;

      await FileSystem.copyAsync({
        from: file.uri,
        to: destinationUri,
      });

      return destinationUri;
    } catch (error) {
      console.warn('Erro ao copiar para armazenamento permanente, usando URI original:', error);
      return file.uri;
    }
  };

  // 1. ABRIR SELETOR DE ARQUIVOS
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const defaultName = file.name.replace(/\.[^/.]+$/, '');
        setSoundNameInput(defaultName);
        setPendingFile(file);
        setSoundModalVisible(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo de áudio.');
    }
  };

  // 2. CONFIRMAR E ADICIONAR SOM NO PERFIL ATIVO
  const confirmAddSound = async () => {
    if (!pendingFile) return;

    try {
      const permanentUri = await copyAudioToPermanentStorage(pendingFile);
      const newSound = {
        id: Date.now().toString(),
        name: soundNameInput.trim() || 'Sem Nome',
        uri: permanentUri,
        volume: 0.7,
      };

      const updatedProfiles = profiles.map(p => {
        if (p.id === activeProfile.id) {
          return {
            ...p,
            sounds: [...(p.sounds || []), newSound],
          };
        }
        return p;
      });

      await persistProfiles(updatedProfiles);
      setSoundModalVisible(false);
      setPendingFile(null);
      setSoundNameInput('');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar o som.');
    }
  };

  // 3. TOCAR / PAUSAR SOM (COM LOOP INFINITO)
  const toggleSound = (sound) => {
    try {
      let player = playersRef.current[sound.id];
      const isCurrentlyPlaying = !!playingMap[sound.id];

      if (isCurrentlyPlaying) {
        if (player) {
          player.pause();
        }
        setPlayingMap(prev => ({ ...prev, [sound.id]: false }));
      } else {
        if (!player) {
          player = createAudioPlayer({ uri: sound.uri });
          player.loop = true;
          player.volume = sound.volume ?? 0.7;
          playersRef.current[sound.id] = player;
        } else {
          player.volume = sound.volume ?? 0.7;
          player.loop = true;
        }
        player.play();
        setPlayingMap(prev => ({ ...prev, [sound.id]: true }));
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível reproduzir este som.');
    }
  };

  // 4. AJUSTAR VOLUME INDIVIDUAL
  const adjustVolume = async (sound, delta) => {
    const currentVol = sound.volume ?? 0.7;
    const newVolume = Math.min(1, Math.max(0, parseFloat((currentVol + delta).toFixed(1))));

    // Atualiza no player nativo imediatamente se estiver ativo
    const player = playersRef.current[sound.id];
    if (player) {
      player.volume = newVolume;
    }

    const updatedProfiles = profiles.map(p => {
      if (p.id === activeProfile.id) {
        return {
          ...p,
          sounds: p.sounds.map(s => (s.id === sound.id ? { ...s, volume: newVolume } : s)),
        };
      }
      return p;
    });

    await persistProfiles(updatedProfiles);
  };

  // 5. REMOVER SOM
  const removeSound = async (sound) => {
    const player = playersRef.current[sound.id];
    if (player) {
      try {
        player.pause();
        player.remove();
      } catch (e) {}
      delete playersRef.current[sound.id];
    }

    setPlayingMap(prev => {
      const updated = { ...prev };
      delete updated[sound.id];
      return updated;
    });

    const updatedProfiles = profiles.map(p => {
      if (p.id === activeProfile.id) {
        return {
          ...p,
          sounds: p.sounds.filter(s => s.id !== sound.id),
        };
      }
      return p;
    });

    await persistProfiles(updatedProfiles);
  };

  // 6. BOTÃO DE EMERGÊNCIA: PARAR TUDO
  const stopAllSounds = () => {
    Object.keys(playersRef.current).forEach(id => {
      try {
        playersRef.current[id].pause();
      } catch (e) {}
    });
    setPlayingMap({});
  };

  // 7. CRIAR NOVO PERFIL / CENA
  const handleCreateProfile = async () => {
    const name = profileNameInput.trim();
    if (!name) return;

    const newProfile = {
      id: `scene-${Date.now()}`,
      name: name,
      sounds: [],
    };

    const updated = [...profiles, newProfile];
    await persistProfiles(updated, newProfile.id);
    setActiveProfileId(newProfile.id);
    setProfileNameInput('');
    setProfileModalVisible(false);
  };

  // 8. RENOMEAR PERFIL ATIVO
  const handleRenameProfile = async () => {
    const name = profileNameInput.trim();
    if (!name) return;

    const updated = profiles.map(p => {
      if (p.id === activeProfile.id) {
        return { ...p, name };
      }
      return p;
    });

    await persistProfiles(updated);
    setProfileNameInput('');
    setRenameModalVisible(false);
  };

  // 9. EXCLUIR PERFIL ATIVO
  const handleDeleteProfile = () => {
    if (profiles.length <= 1) {
      Alert.alert('Aviso', 'Você não pode excluir o único perfil existente.');
      return;
    }

    Alert.alert(
      'Excluir Cena',
      `Tem certeza que deseja excluir a cena "${activeProfile.name}" e seus sons associados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            // Para os sons do perfil atual
            activeProfile.sounds.forEach(s => {
              if (playersRef.current[s.id]) {
                try {
                  playersRef.current[s.id].pause();
                  playersRef.current[s.id].remove();
                } catch (e) {}
                delete playersRef.current[s.id];
              }
            });

            const remaining = profiles.filter(p => p.id !== activeProfile.id);
            const nextActiveId = remaining[0].id;
            setActiveProfileId(nextActiveId);
            await persistProfiles(remaining, nextActiveId);
          },
        },
      ]
    );
  };

  const hasPlayingSounds = Object.values(playingMap).some(Boolean);

  const renderSoundCard = ({ item }) => {
    const isPlaying = !!playingMap[item.id];
    const volumePercent = Math.round((item.volume ?? 0.7) * 100);

    return (
      <View style={[styles.soundCard, isPlaying && styles.soundCardActive]}>
        <View style={styles.topRow}>
          <View style={styles.soundInfo}>
            <Text style={styles.soundName} numberOfLines={1}>
              {item.name}
            </Text>
            {isPlaying && <Text style={styles.loopBadge}>🔁 Tocando em Loop</Text>}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.playButton, isPlaying && styles.playButtonActive]}
              onPress={() => toggleSound(item)}
            >
              <Text style={[styles.playButtonText, isPlaying && styles.playButtonTextActive]}>
                {isPlaying ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() =>
                Alert.alert('Remover Som', `Remover "${item.name}" desta cena?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Remover', style: 'destructive', onPress: () => removeSound(item) },
                ])
              }
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barra de volume individual */}
        <View style={styles.volumeRow}>
          <TouchableOpacity
            style={styles.volumeBtn}
            onPress={() => adjustVolume(item, -0.1)}
          >
            <Text style={styles.volumeBtnText}>🔉</Text>
          </TouchableOpacity>

          <View style={styles.volumeBarContainer}>
            <View style={[styles.volumeBarFill, { width: `${volumePercent}%` }]} />
          </View>

          <Text style={styles.volumeText}>{volumePercent}%</Text>

          <TouchableOpacity
            style={styles.volumeBtn}
            onPress={() => adjustVolume(item, 0.1)}
          >
            <Text style={styles.volumeBtnText}>🔊</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Cabeçalho Principal */}
      <View style={styles.header}>
        <Text style={styles.title}>⚔️ RPG SOUNDBOARD</Text>
        {hasPlayingSounds && (
          <TouchableOpacity style={styles.stopAllButton} onPress={stopAllSounds}>
            <Text style={styles.stopAllButtonText}>⏹ Silenciar Tudo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Barra de Seleção de Perfis / Cenas */}
      <View style={styles.sceneBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sceneScrollContainer}
        >
          {profiles.map(p => {
            const isActive = p.id === activeProfile.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.sceneTab, isActive && styles.sceneTabActive]}
                onPress={() => {
                  setActiveProfileId(p.id);
                  AsyncStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, p.id);
                }}
              >
                <Text style={[styles.sceneTabText, isActive && styles.sceneTabTextActive]}>
                  {p.name}
                </Text>
                {p.sounds && p.sounds.length > 0 && (
                  <View style={[styles.soundCountBadge, isActive && styles.soundCountBadgeActive]}>
                    <Text style={styles.soundCountText}>{p.sounds.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Botão para Adicionar Nova Cena */}
          <TouchableOpacity
            style={styles.addSceneTab}
            onPress={() => {
              setProfileNameInput('');
              setProfileModalVisible(true);
            }}
          >
            <Text style={styles.addSceneTabText}>+ Nova Cena</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Barra de Gerenciamento da Cena Atual */}
      <View style={styles.activeSceneInfoRow}>
        <View style={styles.activeSceneTitleContainer}>
          <Text style={styles.activeSceneLabel}>Cena Ativa:</Text>
          <Text style={styles.activeSceneTitle} numberOfLines={1}>
            {activeProfile?.name}
          </Text>
        </View>

        <View style={styles.activeSceneActions}>
          <TouchableOpacity
            style={styles.sceneActionBtn}
            onPress={() => {
              setProfileNameInput(activeProfile.name);
              setRenameModalVisible(true);
            }}
          >
            <Text style={styles.sceneActionBtnText}>✏️ Renomear</Text>
          </TouchableOpacity>

          {profiles.length > 1 && (
            <TouchableOpacity
              style={[styles.sceneActionBtn, styles.sceneDeleteBtn]}
              onPress={handleDeleteProfile}
            >
              <Text style={styles.sceneDeleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Botão de Adicionar Som à Cena */}
      <TouchableOpacity style={styles.addButton} onPress={pickAudio}>
        <Text style={styles.addButtonText}>+ Adicionar Som a "{activeProfile?.name}"</Text>
      </TouchableOpacity>

      {/* Lista de Sons da Cena */}
      <FlatList
        data={activeProfile?.sounds || []}
        keyExtractor={item => item.id}
        renderItem={renderSoundCard}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nenhum som nesta cena</Text>
            <Text style={styles.emptySubtitle}>
              Toque no botão roxo acima para selecionar áudios (MP3, WAV, etc.) do seu celular e
              salvá-los nesta cena.
            </Text>
          </View>
        }
      />

      {/* MODAL 1: Nomear Som ao Adicionar */}
      <Modal
        visible={soundModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSoundModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar à Cena</Text>
            <Text style={styles.modalSubtitle}>Arquivo: {pendingFile?.name}</Text>

            <TextInput
              style={styles.input}
              placeholder="Ex: Música de Combate, Barulho de Chuva..."
              placeholderTextColor="#777"
              value={soundNameInput}
              onChangeText={setSoundNameInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSoundModalVisible(false);
                  setPendingFile(null);
                  setSoundNameInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={confirmAddSound}>
                <Text style={styles.confirmButtonText}>Salvar Som</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Criar Nova Cena */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Cena de Áudio</Text>
            <Text style={styles.modalSubtitle}>
              Exemplos: Batalha, Floresta Noturna, Masmorra, Cidade...
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome da cena..."
              placeholderTextColor="#777"
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setProfileModalVisible(false);
                  setProfileNameInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={handleCreateProfile}>
                <Text style={styles.confirmButtonText}>Criar Cena</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Renomear Cena */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Renomear Cena</Text>

            <TextInput
              style={styles.input}
              placeholder="Novo nome da cena..."
              placeholderTextColor="#777"
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setRenameModalVisible(false);
                  setProfileNameInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={handleRenameProfile}>
                <Text style={styles.confirmButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131317',
    paddingTop: 55,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#E5A93D',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stopAllButton: {
    backgroundColor: '#8B0000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  stopAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Barra de Cenas / Perfis
  sceneBarWrapper: {
    marginBottom: 14,
  },
  sceneScrollContainer: {
    gap: 8,
    alignItems: 'center',
  },
  sceneTab: {
    backgroundColor: '#202028',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30303E',
  },
  sceneTabActive: {
    backgroundColor: '#5C3C92',
    borderColor: '#E5A93D',
  },
  sceneTabText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  sceneTabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  soundCountBadge: {
    backgroundColor: '#30303E',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  soundCountBadgeActive: {
    backgroundColor: '#E5A93D',
  },
  soundCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addSceneTab: {
    backgroundColor: '#1E1E26',
    borderWidth: 1,
    borderColor: '#E5A93D',
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addSceneTabText: {
    color: '#E5A93D',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // Linha de Informações da Cena Ativa
  activeSceneInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1D1D26',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2D2D3B',
  },
  activeSceneTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  activeSceneLabel: {
    color: '#8A8A9E',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeSceneTitle: {
    color: '#E5A93D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeSceneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sceneActionBtn: {
    backgroundColor: '#2A2A38',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sceneActionBtnText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '600',
  },
  sceneDeleteBtn: {
    backgroundColor: '#3A1818',
  },
  sceneDeleteBtnText: {
    color: '#FF6666',
    fontSize: 12,
  },
  // Botão Adicionar Som
  addButton: {
    backgroundColor: '#5C3C92',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5A93D',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listContainer: {
    paddingBottom: 40,
  },
  // Card do Som
  soundCard: {
    backgroundColor: '#20202A',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3A3A4C',
  },
  soundCardActive: {
    borderLeftColor: '#E5A93D',
    backgroundColor: '#262633',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundInfo: {
    flex: 1,
    marginRight: 12,
  },
  soundName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loopBadge: {
    color: '#E5A93D',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    backgroundColor: '#E5A93D',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#5C3C92',
    borderWidth: 1,
    borderColor: '#E5A93D',
  },
  playButtonText: {
    fontSize: 18,
    color: '#131317',
    fontWeight: 'bold',
  },
  playButtonTextActive: {
    color: '#FFFFFF',
  },
  removeButton: {
    backgroundColor: '#351616',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FF5555',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // Linha de Volume
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  volumeBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeBtnText: {
    fontSize: 16,
  },
  volumeBarContainer: {
    flex: 1,
    height: 7,
    backgroundColor: '#14141B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    backgroundColor: '#E5A93D',
    borderRadius: 4,
  },
  volumeText: {
    color: '#E5A93D',
    fontSize: 11,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'center',
  },
  // Vazio
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#E5A93D',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#777788',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  // Modais
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#20202A',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5A93D',
  },
  modalTitle: {
    color: '#E5A93D',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: '#8A8A9E',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#131317',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#38384A',
    marginBottom: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4E4E62',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8E8EA0',
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#5C3C92',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
