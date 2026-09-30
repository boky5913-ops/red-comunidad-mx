import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useMemo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { ScreenContainer } from "@/components/screen-container";
import { getApiBaseUrl } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";
import { buildWhatsAppUrl, isBase64WithinBytes, MAX_COMMUNITY_IMAGES, normalizeMexicanPhone } from "@/shared/community";

const STORAGE_KEY = "red-comunidad-mx.posts.v1";

type Category = "empleo" | "trueque";
type TradeMode = "trueque" | "donacion";
type Filter = "todos" | TradeMode;

type Post = {
  id: string;
  category: Category;
  title: string;
  description: string;
  location: string;
  contactName: string;
  whatsapp: string;
  imageUrls?: string[];
  imageUri?: string;
  mode?: TradeMode;
  createdAt: string;
};

type PreparedImage = { uri: string; base64: string };
type PostDraft = Omit<Post, "id" | "createdAt" | "imageUrls" | "imageUri"> & { images: PreparedImage[] };

const MAX_IMAGES = MAX_COMMUNITY_IMAGES;

const seedPosts: Post[] = [
  {
    id: "seed-job-1",
    category: "empleo",
    title: "Ayudante de cocina",
    description: "Buscamos una persona con ganas de aprender para apoyar en cocina y preparación de alimentos.",
    location: "Coyoacán, CDMX",
    contactName: "Mariana López",
    whatsapp: "5215511112233",
    createdAt: "2026-09-15T13:00:00.000Z",
  },
  {
    id: "seed-job-2",
    category: "empleo",
    title: "Repartidor en bicicleta",
    description: "Trabajo de medio tiempo por las tardes. Zona centro. Pago semanal y horarios flexibles.",
    location: "Guadalajara, Jalisco",
    contactName: "José Luis Hernández",
    whatsapp: "523312223344",
    createdAt: "2026-09-14T16:00:00.000Z",
  },
  {
    id: "seed-trade-1",
    category: "trueque",
    mode: "trueque",
    title: "Bicicleta rodada 26",
    description: "Bicicleta funcional con detalles de uso. Busco cambiarla por una máquina de coser o herramienta.",
    location: "San Andrés Cholula, Puebla",
    contactName: "Nayeli García",
    whatsapp: "522221234567",
    createdAt: "2026-09-16T11:30:00.000Z",
  },
  {
    id: "seed-trade-2",
    category: "trueque",
    mode: "donacion",
    title: "Despensa básica para compartir",
    description: "Tenemos algunos alimentos no perecederos para una familia que los necesite en la zona.",
    location: "Mérida, Yucatán",
    contactName: "Comunidad La Esperanza",
    whatsapp: "529991234567",
    createdAt: "2026-09-16T09:00:00.000Z",
  },
];

const colors = {
  ink: "#2E2521",
  muted: "#7A6F69",
  primary: "#D45B3B",
  primaryDark: "#B6462B",
  cream: "#FFF8F3",
  white: "#FFFFFF",
  line: "#EDE2D9",
  softTerracotta: "#FCE7DE",
  green: "#2F8F63",
  softGreen: "#E7F4EC",
  amber: "#B7791F",
  softAmber: "#FFF2D6",
};

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(isoDate));
}

function resolveStorageUrl(url: string) {
  return url.startsWith("http") ? url : `${getApiBaseUrl()}${url}`;
}

function mapRemotePost(post: {
  id: number;
  category: Category;
  mode: TradeMode | null;
  title: string;
  description: string;
  location: string;
  contactName: string;
  whatsapp: string;
  imageUrls: string[];
  createdAt: Date | string;
}): Post {
  return {
    id: String(post.id),
    category: post.category,
    mode: post.mode ?? undefined,
    title: post.title,
    description: post.description,
    location: post.location,
    contactName: post.contactName,
    whatsapp: post.whatsapp,
    imageUrls: post.imageUrls.map(resolveStorageUrl),
    createdAt: new Date(post.createdAt).toISOString(),
  };
}

function openWhatsApp(post: Post) {
  const message = post.category === "empleo"
    ? `Hola ${post.contactName}, vi tu oferta de empleo \"${post.title}\" en Red Comunidad MX. ¿Sigue disponible?`
    : `Hola ${post.contactName}, vi tu publicación \"${post.title}\" en Red Comunidad MX y me interesa. ¿Podemos platicar?`;
  const webUrl = buildWhatsAppUrl(post.whatsapp, message);
  const nativeUrl = `whatsapp://send?phone=${normalizeMexicanPhone(post.whatsapp)}&text=${encodeURIComponent(message)}`;

  Linking.openURL(Platform.OS === "web" ? webUrl : nativeUrl).catch(() => Linking.openURL(webUrl));
}

function SectionChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {icon ? <MaterialIcons name={icon} size={16} color={active ? colors.white : colors.muted} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PostCard({ post }: { post: Post }) {
  const isJob = post.category === "empleo";
  const imageUrls = post.imageUrls?.length ? post.imageUrls : post.imageUri ? [post.imageUri] : [];
  return (
    <View style={styles.postCard}>
      <View style={styles.postCardTop}>
        <View style={[styles.postIcon, isJob ? styles.jobIcon : styles.tradeIcon]}>
          <MaterialIcons name={isJob ? "work-outline" : post.mode === "donacion" ? "volunteer-activism" : "sync-alt"} size={22} color={isJob ? colors.primary : colors.green} />
        </View>
        <View style={styles.postTitleWrap}>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.metaRow}>
            <MaterialIcons name="location-on" size={14} color={colors.muted} />
            <Text style={styles.metaText}>{post.location}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>{formatDate(post.createdAt)}</Text>
      </View>
      {imageUrls.length ? <View style={styles.postImageWrap}>
        <Image source={{ uri: imageUrls[0] }} style={styles.postImage} resizeMode="cover" />
        {imageUrls.length > 1 ? <View style={styles.imageCountBadge}><MaterialIcons name="collections" size={14} color={colors.white} /><Text style={styles.imageCountText}>{imageUrls.length} fotos</Text></View> : null}
      </View> : null}
      <Text style={styles.postDescription} numberOfLines={3}>{post.description}</Text>
      <View style={styles.postFooter}>
        <View style={styles.personRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{post.contactName.slice(0, 1).toUpperCase()}</Text></View>
          <View>
            <Text style={styles.postedByLabel}>Publicado por</Text>
            <Text style={styles.postedBy}>{post.contactName}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Contactar a ${post.contactName} por WhatsApp`}
          onPress={() => openWhatsApp(post)}
          style={({ pressed }) => [styles.whatsappButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="chat" size={17} color={colors.white} />
          <Text style={styles.whatsappButtonText}>WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PublishModal({
  visible,
  onClose,
  onPublish,
}: {
  visible: boolean;
  onClose: () => void;
  onPublish: (post: PostDraft) => void;
}) {
  const [category, setCategory] = useState<Category>("empleo");
  const [mode, setMode] = useState<TradeMode>("trueque");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [images, setImages] = useState<PreparedImage[]>([]);

  const reset = () => {
    setCategory("empleo");
    setMode("trueque");
    setTitle("");
    setDescription("");
    setLocation("");
    setContactName("");
    setWhatsapp("");
    setImages([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!title.trim() || !description.trim() || !location.trim() || !contactName.trim() || whatsapp.replace(/\\D/g, "").length < 10) {
      Alert.alert("Completa tu publicación", "Agrega título, descripción, ubicación, tu nombre y un WhatsApp válido de 10 dígitos.");
      return;
    }
    onPublish({
      category,
      mode: category === "trueque" ? mode : undefined,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      contactName: contactName.trim(),
      whatsapp: normalizeMexicanPhone(whatsapp),
      images: category === "trueque" ? images : [],
    });
    close();
  };

  const pickImage = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("Límite alcanzado", `Puedes agregar hasta ${MAX_IMAGES} fotos por publicación.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      base64: Platform.OS === "web",
    });
    if (result.canceled) return;
    try {
      const prepared = await Promise.all(result.assets.slice(0, remaining).map(async (asset) => {
        const sourceUri = Platform.OS === "web" && asset.base64
          ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        const compressed = await ImageManipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.68, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        const base64 = compressed.base64 ?? await FileSystem.readAsStringAsync(compressed.uri, { encoding: FileSystem.EncodingType.Base64 });
        if (!isBase64WithinBytes(base64)) throw new Error("Una imagen supera el límite de 3 MB");
        return { uri: Platform.OS === "web" ? `data:image/jpeg;base64,${base64}` : compressed.uri, base64 };
      }));
      setImages((current) => [...current, ...prepared].slice(0, MAX_IMAGES));
    } catch {
      Alert.alert("No se pudo preparar la foto", "Elige imágenes más pequeñas o intenta nuevamente.");
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={close} presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>COMPARTE CON TU COMUNIDAD</Text>
            <Text style={styles.modalTitle}>Nueva publicación</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <MaterialIcons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <FlatList
          data={[{ key: "form" }]}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContent}
          renderItem={() => (
            <View>
              <Text style={styles.fieldLabel}>¿Qué quieres compartir?</Text>
              <View style={styles.segmentRow}>
                <Pressable onPress={() => setCategory("empleo")} style={({ pressed }) => [styles.segment, category === "empleo" && styles.segmentActive, pressed && styles.pressed]}>
                  <MaterialIcons name="work-outline" size={18} color={category === "empleo" ? colors.white : colors.primary} />
                  <Text style={[styles.segmentText, category === "empleo" && styles.segmentTextActive]}>Oferta de empleo</Text>
                </Pressable>
                <Pressable onPress={() => setCategory("trueque")} style={({ pressed }) => [styles.segment, category === "trueque" && styles.segmentActiveGreen, pressed && styles.pressed]}>
                  <MaterialIcons name="sync-alt" size={18} color={category === "trueque" ? colors.white : colors.green} />
                  <Text style={[styles.segmentText, category === "trueque" && styles.segmentTextActive]}>Trueque / donación</Text>
                </Pressable>
              </View>
              {category === "trueque" ? (
                <View style={styles.modeRow}>
                  <SectionChip label="Trueque" active={mode === "trueque"} onPress={() => setMode("trueque")} icon="sync-alt" />
                  <SectionChip label="Donación" active={mode === "donacion"} onPress={() => setMode("donacion")} icon="volunteer-activism" />
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder={category === "empleo" ? "Ej. Ayudante de panadería" : "Ej. Silla de bebé en buen estado"} placeholderTextColor="#A99B93" style={styles.input} returnKeyType="next" />
              <Text style={styles.fieldLabel}>Cuéntanos un poco más</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Describe lo que ofreces o buscas..." placeholderTextColor="#A99B93" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />
              {category === "trueque" ? (
                <>
                  <Text style={styles.fieldLabel}>Fotos del artículo <Text style={styles.optionalLabel}>(opcional, hasta {MAX_IMAGES})</Text></Text>
                  <Pressable onPress={pickImage} style={({ pressed }) => [styles.imagePicker, pressed && styles.pressed]}>
                    <View style={styles.imagePickerIcon}><MaterialIcons name="add-a-photo" size={22} color={colors.green} /></View>
                    <View style={styles.imagePickerCopy}>
                      <Text style={styles.imagePickerTitle}>{images.length ? "Agregar más fotos" : "Agrega fotos"}</Text>
                      <Text style={styles.imagePickerHelper}>{images.length}/{MAX_IMAGES} seleccionadas · Se comprimen automáticamente</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
                  </Pressable>
                  {images.length ? <FlatList horizontal data={images} keyExtractor={(_, index) => `image-${index}`} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageStrip} renderItem={({ item, index }) => <View style={styles.selectedImageWrap}><Image source={{ uri: item.uri }} style={styles.selectedImage} resizeMode="cover" /><Pressable onPress={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))} style={styles.removeImage}><MaterialIcons name="close" size={13} color={colors.white} /></Pressable></View>} /> : null}
                </>
              ) : null}
              <Text style={styles.fieldLabel}>Zona o municipio</Text>
              <TextInput value={location} onChangeText={setLocation} placeholder="Ej. Centro, Oaxaca" placeholderTextColor="#A99B93" style={styles.input} />
              <View style={styles.formDivider} />
              <Text style={styles.formSectionTitle}>Tu contacto</Text>
              <Text style={styles.formHelper}>Solo mostraremos tu nombre. El número se usará para abrir WhatsApp.</Text>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput value={contactName} onChangeText={setContactName} placeholder="Tu nombre o el de tu negocio" placeholderTextColor="#A99B93" style={styles.input} />
              <Text style={styles.fieldLabel}>WhatsApp</Text>
              <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="10 dígitos, sin espacios" placeholderTextColor="#A99B93" style={styles.input} keyboardType="phone-pad" />
              <Pressable onPress={submit} style={({ pressed }) => [styles.publishButton, pressed && styles.pressed]}>
                <MaterialIcons name="publish" size={20} color={colors.white} />
                <Text style={styles.publishButtonText}>Publicar gratis</Text>
              </Pressable>
              <Text style={styles.safetyNote}>Al publicar, acuerda encuentros en lugares seguros y no compartas información sensible.</Text>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>(seedPosts);
  const [category, setCategory] = useState<Category>("empleo");
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { data: remotePosts = [] } = trpc.community.list.useQuery();
  const uploadImageMutation = trpc.media.uploadImage.useMutation();
  const createRemotePostMutation = trpc.community.create.useMutation();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setPosts(JSON.parse(stored));
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const persistPosts = (nextPosts: Post[]) => {
    setPosts(nextPosts);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPosts)).catch(() => undefined);
  };

  const handlePublish = async (post: PostDraft) => {
    try {
      const imageUrls: string[] = [];
      for (const image of post.images) {
        const url = await uploadImageMutation.mutateAsync({ base64: image.base64, contentType: "image/jpeg", extension: "jpg" });
        imageUrls.push(resolveStorageUrl(url));
      }
      const created = await createRemotePostMutation.mutateAsync({
        category: post.category,
        mode: post.mode,
        title: post.title,
        description: post.description,
        location: post.location,
        contactName: post.contactName,
        whatsapp: post.whatsapp,
        imageUrls,
      });
      const nextPost = mapRemotePost(created);
      persistPosts([nextPost, ...posts]);
      setCategory(nextPost.category);
      setFilter("todos");
      Alert.alert("¡Publicación compartida!", "Tu artículo y sus fotos ya están disponibles para la comunidad.");
    } catch {
      const localPost: Post = {
        ...post,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
        imageUrls: post.images.map((image) => image.uri),
      };
      persistPosts([localPost, ...posts]);
      setCategory(localPost.category);
      setFilter("todos");
      Alert.alert("Guardada en este dispositivo", "No se pudo sincronizar con la nube. Tu publicación se guardó localmente para no perderla.");
    }
  };

  const allPosts = useMemo(() => {
    const merged = new Map<string, Post>();
    posts.forEach((post) => merged.set(post.id, post));
    remotePosts.forEach((post) => {
      const mapped = mapRemotePost(post);
      merged.set(mapped.id, mapped);
    });
    return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts, remotePosts]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allPosts.filter((post) => {
      const sameCategory = post.category === category;
      const sameFilter = category === "empleo" || filter === "todos" || post.mode === filter;
      const matchesQuery = !normalizedQuery || `${post.title} ${post.description} ${post.location}`.toLowerCase().includes(normalizedQuery);
      return sameCategory && sameFilter && matchesQuery;
    });
  }, [allPosts, category, filter, query]);

  const switchCategory = (nextCategory: Category) => {
    setCategory(nextCategory);
    setFilter("todos");
    setQuery("");
  };

  if (!hydrated) {
    return (
      <ScreenContainer containerClassName="bg-background" className="items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Cargando la comunidad...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" className="flex-1">
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={styles.brandLockup}>
                <View style={styles.brandMark}><MaterialIcons name="people-alt" size={21} color={colors.white} /></View>
                <View>
                  <Text style={styles.brandName}>Red Comunidad</Text>
                  <Text style={styles.brandSubname}>MÉXICO</Text>
                </View>
              </View>
              <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>GRATIS</Text></View>
            </View>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>HECHO PARA APOYARNOS</Text>
              <Text style={styles.heroTitle}>Lo que necesitas.{"\n"}<Text style={styles.heroTitleAccent}>Lo que puedes ofrecer.</Text></Text>
              <Text style={styles.heroBody}>Encuentra oportunidades, comparte lo que tienes y conecta con personas de tu comunidad.</Text>
            </View>
            <View style={styles.categoryTabs}>
              <Pressable onPress={() => switchCategory("empleo")} style={({ pressed }) => [styles.categoryTab, category === "empleo" && styles.categoryTabActive, pressed && styles.pressed]}>
                <MaterialIcons name="work-outline" size={20} color={category === "empleo" ? colors.primary : colors.muted} />
                <View><Text style={[styles.categoryTabTitle, category === "empleo" && styles.categoryTabTitleActive]}>Empleo</Text><Text style={styles.categoryTabCaption}>Busca u ofrece</Text></View>
              </Pressable>
              <Pressable onPress={() => switchCategory("trueque")} style={({ pressed }) => [styles.categoryTab, category === "trueque" && styles.categoryTabActiveGreen, pressed && styles.pressed]}>
                <MaterialIcons name="sync-alt" size={20} color={category === "trueque" ? colors.green : colors.muted} />
                <View><Text style={[styles.categoryTabTitle, category === "trueque" && styles.categoryTabTitleGreen]}>Trueque y donación</Text><Text style={styles.categoryTabCaption}>Intercambia y comparte</Text></View>
              </Pressable>
            </View>
            <View style={styles.sectionHeadingRow}>
              <View><Text style={styles.sectionKicker}>{category === "empleo" ? "OPORTUNIDADES CERCA DE TI" : "CIRCULA LO QUE YA EXISTE"}</Text><Text style={styles.sectionTitle}>{category === "empleo" ? "Ofertas de empleo" : "Publicaciones de la comunidad"}</Text></View>
              <Pressable onPress={() => setIsPublishOpen(true)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="add" size={18} color={colors.white} /><Text style={styles.addButtonText}>Publicar</Text></Pressable>
            </View>
            {category === "trueque" ? (
              <View style={styles.filterRow}>
                <SectionChip label="Todo" active={filter === "todos"} onPress={() => setFilter("todos")} />
                <SectionChip label="Trueque" active={filter === "trueque"} onPress={() => setFilter("trueque")} icon="sync-alt" />
                <SectionChip label="Donación" active={filter === "donacion"} onPress={() => setFilter("donacion")} icon="volunteer-activism" />
              </View>
            ) : (
              <View style={styles.audienceHint}><MaterialIcons name="search" size={17} color={colors.primary} /><Text style={styles.audienceHintText}>¿Buscas trabajo? Explora las ofertas y escribe directo por WhatsApp.</Text></View>
            )}
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder={category === "empleo" ? "Busca por puesto o zona" : "Busca por artículo o zona"} placeholderTextColor="#A99B93" style={styles.searchInput} returnKeyType="search" />
              {query ? <Pressable onPress={() => setQuery("")}><MaterialIcons name="close" size={18} color={colors.muted} /></Pressable> : null}
            </View>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={<View style={styles.emptyState}><View style={styles.emptyIcon}><MaterialIcons name="travel-explore" size={28} color={colors.primary} /></View><Text style={styles.emptyTitle}>Aún no hay publicaciones aquí</Text><Text style={styles.emptyBody}>Sé la primera persona en compartir algo con tu comunidad.</Text><Pressable onPress={() => setIsPublishOpen(true)} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>Crear publicación</Text></Pressable></View>}
        ListFooterComponent={<View style={styles.footer}><MaterialIcons name="verified-user" size={16} color={colors.green} /><Text style={styles.footerText}>Conecta con respeto. Verifica la información antes de cerrar un trato.</Text></View>}
      />
      <PublishModal visible={isPublishOpen} onClose={() => setIsPublishOpen(false)} onPublish={handlePublish} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }] },
  brandName: { color: colors.ink, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  brandSubname: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 2.4, marginTop: 2 },
  freeBadge: { backgroundColor: colors.softGreen, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  freeBadgeText: { color: colors.green, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  hero: { marginBottom: 22 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, marginBottom: 8 },
  heroTitle: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -1.1 },
  heroTitleAccent: { color: colors.primary },
  heroBody: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 360 },
  categoryTabs: { flexDirection: "row", gap: 10, marginBottom: 27 },
  categoryTab: { flex: 1, minHeight: 74, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  categoryTabActive: { borderColor: colors.primary, backgroundColor: colors.softTerracotta },
  categoryTabActiveGreen: { borderColor: colors.green, backgroundColor: colors.softGreen },
  categoryTabTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  categoryTabTitleActive: { color: colors.primaryDark },
  categoryTabTitleGreen: { color: colors.green },
  categoryTabCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 13 },
  sectionKicker: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  audienceHint: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.softTerracotta, borderRadius: 12, padding: 11, marginBottom: 14 },
  audienceHintText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  searchBox: { height: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 8, marginBottom: 14 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 0 },
  postCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.line, shadowColor: "#8A5B45", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  postCardTop: { flexDirection: "row", alignItems: "flex-start" },
  postIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 10 },
  jobIcon: { backgroundColor: colors.softTerracotta },
  tradeIcon: { backgroundColor: colors.softGreen },
  postTitleWrap: { flex: 1, paddingTop: 1 },
  postTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  metaText: { color: colors.muted, fontSize: 12 },
  dateText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  postDescription: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 13, marginBottom: 14 },
  postImageWrap: { width: "100%", height: 170, borderRadius: 13, marginTop: 13, overflow: "hidden", backgroundColor: "#F3EAE3" },
  postImage: { width: "100%", height: "100%", backgroundColor: "#F3EAE3" },
  imageCountBadge: { position: "absolute", right: 9, bottom: 9, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(46,37,33,0.78)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  imageCountText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  postFooter: { borderTopWidth: 1, borderTopColor: "#F2EAE4", paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.softAmber, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.amber, fontSize: 12, fontWeight: "800" },
  postedByLabel: { color: colors.muted, fontSize: 10 },
  postedBy: { color: colors.ink, fontSize: 12, fontWeight: "700", marginTop: 1 },
  whatsappButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.green, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9 },
  whatsappButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 18, paddingHorizontal: 4 },
  footerText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  emptyState: { alignItems: "center", backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 28, marginTop: 3 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.softTerracotta, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6, maxWidth: 250 },
  emptyButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  emptyButtonText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  loadingText: { color: colors.muted, fontSize: 13, marginTop: 12 },
  modalRoot: { flex: 1, backgroundColor: colors.cream },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.cream },
  modalEyebrow: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  modalTitle: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  closeButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  formContent: { padding: 18, paddingBottom: 36 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800", marginBottom: 7, marginTop: 14 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, minHeight: 61, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: colors.white },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentActiveGreen: { backgroundColor: colors.green, borderColor: colors.green },
  segmentText: { color: colors.ink, fontSize: 12, fontWeight: "700", textAlign: "center" },
  segmentTextActive: { color: colors.white },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 13, color: colors.ink, fontSize: 14 },
  textArea: { minHeight: 95, paddingTop: 12 },
  optionalLabel: { color: colors.muted, fontWeight: "500" },
  imagePicker: { minHeight: 76, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white, padding: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  imagePickerIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" },
  imagePreview: { width: 58, height: 58, borderRadius: 11, backgroundColor: colors.softGreen },
  imagePickerCopy: { flex: 1 },
  imagePickerTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  imagePickerHelper: { color: colors.muted, fontSize: 11, marginTop: 3 },
  imageStrip: { gap: 8, paddingTop: 9, paddingBottom: 2 },
  selectedImageWrap: { width: 70, height: 70, borderRadius: 12, overflow: "hidden", backgroundColor: colors.softGreen },
  selectedImage: { width: "100%", height: "100%" },
  removeImage: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(46,37,33,0.78)", alignItems: "center", justifyContent: "center" },
  removeImageText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  formDivider: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 22, paddingTop: 19 },
  formSectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  formHelper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  publishButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, minHeight: 52, marginTop: 24 },
  publishButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  safetyNote: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: 12, paddingHorizontal: 12 },
});
