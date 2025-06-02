import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:rxdart/rxdart.dart';
import 'notification_service.dart';
import 'dart:async';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;

  WebSocketService._internal();

  WebSocketChannel? _channel;
  final BehaviorSubject<String> _messageStream = BehaviorSubject<String>();
  bool _isConnected = false;
  Timer? _reconnectTimer;

  Stream<String> get stream => _messageStream.stream;

  void connect() {
    if (_isConnected) return;

    try {
      // ✅ If your server expects a path like /ws, change it here
      final uri = Uri.parse('ws://13.60.16.112:4000/ws');

      _channel = WebSocketChannel.connect(uri);

      _channel?.stream.listen(
        (message) {
          print('📩 WebSocket message: $message');
          _messageStream.add(message);
          NotificationService.showNotification(message);
        },
        onError: (error) {
          print('❌ WebSocket error: $error');
          _isConnected = false;
          _messageStream.addError(error);
          _scheduleReconnect();
        },
        onDone: () {
          print('🔌 WebSocket closed');
          _isConnected = false;
          _scheduleReconnect();
        },
      );

      _isConnected = true;
      print('✅ WebSocket connected');
    } catch (e) {
      _isConnected = false;
      print('🚨 Failed to connect: $e');
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_reconnectTimer != null && _reconnectTimer!.isActive) return;

    print('🔁 Scheduling reconnect in 5 seconds...');
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      print('🔁 Attempting to reconnect...');
      connect();
    });
  }

  void send(String message) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(message);
      print('📤 Sent: $message');
    } else {
      print('⚠️ Cannot send. WebSocket is not connected.');
    }
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _isConnected = false;
    print('🔌 Disconnected WebSocket');
  }
}