import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  bool _loading = false;
  late final AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    _appLinks = AppLinks();
    _initializeDeepLinking();
  }

  void _initializeDeepLinking() {
    _linkSubscription = _appLinks.uriLinkStream.listen(
      _handleIncomingLink,
      onError: (err) {
        debugPrint('Deep link error: $err');
        if (mounted) {
          _showMessage('Link error: $err');
        }
      },
    );
    _handleInitialLink();
  }

  Future<void> _handleInitialLink() async {
    try {
      final initialUri = await _appLinks.getInitialAppLink();
      if (initialUri != null) {
        debugPrint('Initial deep link: $initialUri');
        _handleIncomingLink(initialUri);
      }
    } catch (e) {
      debugPrint('Failed to get initial link: $e');
    }
  }

  void _handleIncomingLink(Uri uri) async {
    debugPrint('Received deep link: $uri');
    if (uri.scheme == 'app0' &&
        uri.host == 'auth' &&
        uri.path.contains('callback')) {
      final token = uri.queryParameters['token'];
      if (token != null && token.isNotEmpty) {
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('token', token);
          if (mounted) {
            Navigator.pushReplacementNamed(context, '/main');
          }
        } catch (e) {
          _showMessage('Error saving token: $e');
        }
      } else {
        _showMessage('Authentication failed: No token received');
      }
    } else {
      debugPrint('Unrecognized deep link format.');
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _handleGetStarted() async {
    setState(() => _loading = true);

    const authUrl = 'http://13.61.182.165:4000/auth/42';
    final uri = Uri.parse(authUrl);

    try {
      if (await canLaunchUrl(uri)) {
        final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched) throw 'Could not launch URL';
      } else {
        throw 'Cannot launch URL';
      }
    } catch (e) {
      _showMessage('Could not open login URL: $e');
      setState(() => _loading = false);
    }
  }

  void _showMessage(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image
          Image.asset(
            'assets/images/event_bg.png',
            fit: BoxFit.cover,
          ),

          // Blur and dark overlay
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 4.0, sigmaY: 4.0),
            child: Container(
              color: Colors.black.withOpacity(0.4),
            ),
          ),

          // Foreground content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  const Spacer(flex: 2),
                  Text(
                    '1337 Events',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 32,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Welcome to the event app.\nLet\'s get started!',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.white70,
                          fontSize: 16,
                          height: 1.5,
                        ),
                  ),
                  const Spacer(flex: 3),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _handleGetStarted,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        backgroundColor: Colors.greenAccent[400],
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: _loading
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor:
                                        AlwaysStoppedAnimation<Color>(Colors.black),
                                  ),
                                ),
                                SizedBox(width: 12),
                                Text('Authenticating...'),
                              ],
                            )
                          : const Text('Get Started'),
                    ),
                  ),
                  if (_loading) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Please complete authentication in your browser,\nthen return to the app.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                    ),
                  ],
                  const Spacer(flex: 1),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
