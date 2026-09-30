import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type ProfilePost = {
  id: number;
  category: "empleo" | "trueque";
  mode: "trueque" | "donacion" | null;
  title: string;
  description: string;
  location: string;
  contactName: string;
  whatsapp: string;
  imageUrls: string[];
  createdAt: string | Date;
};

type EditablePost = Pick<ProfilePost, "id" | "title" | "description" | "location" | "contactName" | "whatsapp">;

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
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(value));
}

function ProfilePostCard({ post, onEdit, onDelete }: { post: ProfilePost; onEdit: () => void; onDelete: () => void }) {
  const image = post.imageUrls[0];
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.postIcon, post.category === "empleo" ? styles.jobIcon : styles.tradeIcon]}>
          <MaterialIcons name={post.category === "empleo" ? "work-outline" : "sync-alt"} size={21} color={post.category === "empleo" ? colors.primary : colors.green} />
        </View>
        <View style={styles.postTitleWrap}>
          <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
          <Text style={styles.postMeta}>{post.location} · {formatDate(post.createdAt)}</Text>
        </View>
        <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVA</Text></View>
      </View>
      {image ? <Image source={{ uri: image }} style={styles.postImage} resizeMode="cover" /> : null}
      <Text style={styles.postDescription} numberOfLines={2}>{post.description}</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={onEdit} accessibilityRole="button" style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
          <Text style={styles.editButtonText}>Editar</Text>
        </Pressable>
        <Pressable onPress={onDelete} accessibilityRole="button" style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <MaterialIcons name="delete-outline" size={17} color={colors.primaryDark} />
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditPostModal({ post, onClose, onSaved }: { post: EditablePost | null; onClose: () => void; onSaved: () => void }) {
  const updateMutation = trpc.community.update.useMutation();
  const [title, setTitle] = useState(post?.title ?? "");
  const [description, setDescription] = useState(post?.description ?? "");
  const [location, setLocation] = useState(post?.location ?? "");
  const [contactName, setContactName] = useState(post?.contactName ?? "");
  const [whatsapp, setWhatsapp] = useState(post?.whatsapp ?? "");

  useEffect(() => {
    setTitle(post?.title ?? "");
    setDescription(post?.description ?? "");
    setLocation(post?.location ?? "");
    setContactName(post?.contactName ?? "");
    setWhatsapp(post?.whatsapp ?? "");
  }, [post]);

  const save = async () => {
    if (!post || !title.trim() || !description.trim() || !location.trim() || !contactName.trim() || whatsapp.replace(/\D/g, "").length < 10) {
      Alert.alert("Revisa los datos", "Completa todos los campos y agrega un WhatsApp válido de 10 dígitos.");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: post.id, title: title.trim(), description: description.trim(), location: location.trim(), contactName: contactName.trim(), whatsapp });
      onSaved();
      onClose();
    } catch {
      Alert.alert("No se pudo guardar", "Intenta nuevamente cuando tengas conexión.");
    }
  };

  return (
    <Modal animationType="slide" visible={Boolean(post)} onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <View><Text style={styles.modalEyebrow}>ADMINISTRA TU PUBLICACIÓN</Text><Text style={styles.modalTitle}>Editar publicación</Text></View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.closeButton}><MaterialIcons name="close" size={22} color={colors.ink} /></Pressable>
        </View>
        <FlatList
          data={[{ key: "edit" }]}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContent}
          renderItem={() => <View>
            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor="#A99B93" />
            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.textArea]} multiline textAlignVertical="top" placeholderTextColor="#A99B93" />
            <Text style={styles.fieldLabel}>Zona o municipio</Text>
            <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholderTextColor="#A99B93" />
            <View style={styles.formDivider} />
            <Text style={styles.formSectionTitle}>Datos de contacto</Text>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput value={contactName} onChangeText={setContactName} style={styles.input} placeholderTextColor="#A99B93" />
            <Text style={styles.fieldLabel}>WhatsApp</Text>
            <TextInput value={whatsapp} onChangeText={setWhatsapp} style={styles.input} keyboardType="phone-pad" placeholderTextColor="#A99B93" />
            <Pressable onPress={save} disabled={updateMutation.isPending} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, updateMutation.isPending && styles.disabled]}>
              {updateMutation.isPending ? <ActivityIndicator color={colors.white} /> : <><MaterialIcons name="save" size={19} color={colors.white} /><Text style={styles.saveButtonText}>Guardar cambios</Text></>}
            </Pressable>
          </View>}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const mineQuery = trpc.community.mine.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const removeMutation = trpc.community.remove.useMutation({ onSuccess: () => mineQuery.refetch() });
  const [editingPost, setEditingPost] = useState<EditablePost | null>(null);

  const posts = (mineQuery.data ?? []) as ProfilePost[];
  const displayName = user?.name || user?.email || "Tu perfil";

  const handleDelete = (post: ProfilePost) => {
    Alert.alert("Eliminar publicación", `¿Quieres eliminar “${post.title}”? Esta acción no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => removeMutation.mutate({ id: post.id }) },
    ]);
  };

  if (loading) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loadingText}>Cargando tu perfil...</Text></ScreenContainer>;
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.profilePage}>
          <View style={styles.profileTop}><View style={styles.brandMark}><MaterialIcons name="person" size={24} color={colors.white} /></View><Text style={styles.brandName}>Mi perfil</Text></View>
          <View style={styles.loginCard}>
            <View style={styles.loginIcon}><MaterialIcons name="lock-open" size={30} color={colors.primary} /></View>
            <Text style={styles.loginTitle}>Administra lo que publicas</Text>
            <Text style={styles.loginBody}>Inicia sesión para ver, editar y eliminar tus publicaciones activas desde cualquier dispositivo.</Text>
            <Pressable onPress={() => startOAuthLogin()} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}><MaterialIcons name="login" size={19} color={colors.white} /><Text style={styles.loginButtonText}>Iniciar sesión</Text></Pressable>
            <Text style={styles.loginHint}>Tus publicaciones guardadas sin sesión permanecen en este dispositivo.</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.profileList}
        ListHeaderComponent={<View>
          <View style={styles.profileTop}><View style={styles.profileIdentity}><View style={styles.avatar}><Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text></View><View><Text style={styles.eyebrow}>PERFIL DE COMUNIDAD</Text><Text style={styles.profileTitle}>{displayName}</Text></View></View><Pressable onPress={() => logout()} accessibilityRole="button" style={styles.logoutButton}><MaterialIcons name="logout" size={16} color={colors.muted} /><Text style={styles.logoutText}>Salir</Text></Pressable></View>
          <View style={styles.profileSummary}><View><Text style={styles.summaryNumber}>{posts.length}</Text><Text style={styles.summaryLabel}>publicaciones activas</Text></View><MaterialIcons name="volunteer-activism" size={28} color={colors.green} /></View>
          <Text style={styles.sectionTitle}>Mis publicaciones</Text>
        </View>}
        renderItem={({ item }) => <ProfilePostCard post={item} onEdit={() => setEditingPost(item)} onDelete={() => handleDelete(item)} />}
        ListEmptyComponent={<View style={styles.emptyState}><MaterialIcons name="post-add" size={30} color={colors.primary} /><Text style={styles.emptyTitle}>Todavía no tienes publicaciones</Text><Text style={styles.emptyBody}>Cuando publiques una oferta o un artículo, aparecerá aquí para que puedas administrarlo.</Text></View>}
        ListFooterComponent={<Text style={styles.footerText}>Solo tú puedes editar o eliminar tus publicaciones.</Text>}
      />
      <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} onSaved={() => mineQuery.refetch()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profilePage: { flex: 1, padding: 18 },
  profileList: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  profileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  profileIdentity: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandName: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.softTerracotta, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primaryDark, fontSize: 18, fontWeight: "800" },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  profileTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  logoutButton: { flexDirection: "row", alignItems: "center", gap: 5, padding: 8 },
  logoutText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  loginCard: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: "center", marginTop: 80 },
  loginIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.softTerracotta, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  loginTitle: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center" },
  loginBody: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10 },
  loginButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 13, marginTop: 20 },
  loginButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  loginHint: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 14 },
  profileSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.softGreen, borderRadius: 17, padding: 16, marginBottom: 24 },
  summaryNumber: { color: colors.green, fontSize: 28, fontWeight: "800" },
  summaryLabel: { color: colors.green, fontSize: 12, fontWeight: "700", marginTop: 2 },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", marginBottom: 14 },
  postCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 12 },
  postHeader: { flexDirection: "row", alignItems: "center" },
  postIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 10 },
  jobIcon: { backgroundColor: colors.softTerracotta },
  tradeIcon: { backgroundColor: colors.softGreen },
  postTitleWrap: { flex: 1 },
  postTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  postMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  activeBadge: { backgroundColor: colors.softGreen, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  activeBadgeText: { color: colors.green, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  postImage: { width: "100%", height: 150, borderRadius: 13, marginTop: 12, backgroundColor: colors.softGreen },
  postDescription: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 9, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 13, paddingTop: 11 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.softTerracotta, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  editButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  deleteButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  deleteButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  emptyState: { alignItems: "center", padding: 30, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center", marginTop: 10 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7 },
  footerText: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 16, marginBottom: 10 },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  modalRoot: { flex: 1, backgroundColor: colors.cream },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalEyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", marginTop: 4 },
  closeButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  formContent: { padding: 18, paddingBottom: 38 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "800", marginBottom: 7, marginTop: 14 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 13, color: colors.ink, fontSize: 14 },
  textArea: { minHeight: 96, paddingTop: 12 },
  formDivider: { height: 1, backgroundColor: colors.line, marginVertical: 22 },
  formSectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginBottom: 3 },
  saveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 13, marginTop: 25 },
  saveButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
