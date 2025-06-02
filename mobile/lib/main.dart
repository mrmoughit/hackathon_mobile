import 'package:flutter/material.dart';
import 'welcome_page.dart';
import 'main_page.dart';
import 'myevents_page.dart';
import 'socket_service.dart';
import 'notification_service.dart'; // ✅ Import the notification service

final RouteObserver<ModalRoute<void>> routeObserver = RouteObserver<ModalRoute<void>>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  print('🟢 Flutter initialized');

  await NotificationService.initialize(); // ✅ Init local notifications

  WebSocketService().connect();
  WebSocketService().send("App started");

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    print('📲 MyApp lifecycle observer added');
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    // 👂 Global WebSocket listener to show snackbars & notifications
    WebSocketService().stream.listen((message) {
      print("🎧 Global socket listener: $message");

      // ✅ Show as local notification
      NotificationService.showNotification(message);

      final context = navigatorKey.currentContext;
      if (context != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("📨 Socket: $message"),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        print("⚠️ Context is null, cannot show snackbar");
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    WebSocketService().disconnect();
    print('🛑 App disposed, socket disconnected');
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    print('🔄 App lifecycle changed: $state');

    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        print('🧊 App backgrounded, disconnecting socket');
        WebSocketService().disconnect();
        break;
      case AppLifecycleState.resumed:
        print('🚀 App resumed, reconnecting socket');
        WebSocketService().connect();
        break;
      default:
        print('🙈 Unhandled state: $state');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: '1337 Events',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      navigatorObservers: [routeObserver],
      initialRoute: '/',
      routes: {
        '/': (context) => const WelcomePage(),
        '/main': (context) => const MainPage(),
        '/myevents': (context) => const MyEventsPage(),
      },
    );
  }
}

