import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, MagnifyingGlass, Books, User } from "phosphor-react-native";
import MiniPlayer from "../../components/MiniPlayer";
import { useColors } from "../../lib/colors";

// MiniPlayer is rendered as an absolute overlay so it doesn't affect layout
// We inject it inside each screen's safe area via the screenOptions sceneStyle

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = Platform.OS === "ios" ? 80 : 64;
  const tabBarPaddingBottom = Platform.OS === "ios" ? Math.max(insets.bottom, 20) : Math.max(insets.bottom, 8);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: C.indigo,
          tabBarInactiveTintColor: C.muted,
          tabBarStyle: {
            backgroundColor: C.bg2,
            borderTopWidth: 1,
            borderTopColor: C.border,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: 10,
            height: tabBarHeight + (insets.bottom > 0 ? insets.bottom - (Platform.OS === "ios" ? 20 : 8) : 0),
            elevation: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            marginTop: 2,
          },
          tabBarIconStyle: { marginTop: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center" }}>
                <House size={22} color={color} weight={focused ? "fill" : "regular"} />
                {focused && (
                  <View style={{
                    position: "absolute", bottom: -6,
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: C.indigo,
                  }} />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center" }}>
                <MagnifyingGlass size={22} color={color} weight={focused ? "bold" : "regular"} />
                {focused && (
                  <View style={{
                    position: "absolute", bottom: -6,
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: C.indigo,
                  }} />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center" }}>
                <Books size={22} color={color} weight={focused ? "fill" : "regular"} />
                {focused && (
                  <View style={{
                    position: "absolute", bottom: -6,
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: C.indigo,
                  }} />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center" }}>
                <User size={22} color={color} weight={focused ? "fill" : "regular"} />
                {focused && (
                  <View style={{
                    position: "absolute", bottom: -6,
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: C.indigo,
                  }} />
                )}
              </View>
            ),
          }}
        />
      </Tabs>
      <MiniPlayer />
    </>
  );
}
