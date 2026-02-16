
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class EventPage1 extends StatefulWidget {
  final Map<String, dynamic> event;
  const EventPage1({super.key, required this.event});

  @override
  State<EventPage1> createState() => _EventPage1State();
}

class _EventPage1State extends State<EventPage1> {
  bool isRegistered = false;
  bool isLoading = true;
  bool isSaved = false;

  @override
  void initState() {
    super.initState();
    _checkRegistrationStatus();
    _checkSavedStatus();
  }

  Future<void> _checkRegistrationStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final eventId = widget.event['id'] ?? widget.event['event_id'];

    if (token == null || eventId == null) return;

    final response = await http.get(
      Uri.parse('http://13.61.182.165:4000/is_resgiter?event_id=$eventId'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      try {
        final data = json.decode(response.body);
        setState(() {
          isRegistered = data['registered'] ?? false;
        });
      } catch (e) {
        debugPrint('JSON parse error: $e');
      }
    } else {
      debugPrint('Check registration failed: ${response.statusCode}');
    }

    setState(() => isLoading = false);
  }

  Future<void> _checkSavedStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final eventId = widget.event['id'] ?? widget.event['event_id'];

    if (token == null || eventId == null) return;

    final response = await http.get(
      Uri.parse('http://13.61.182.165:4000/is_saved?event_id=$eventId'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      try {
        final data = json.decode(response.body);
        setState(() {
          isSaved = data['is_registered'];
        });
      } catch (e) {
        debugPrint('Error parsing saved status: $e');
      }
    } else {
      debugPrint('Failed to check saved status: ${response.statusCode}');
    }
  }

Future<void> _toggleSaveEvent() async {
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('token');
  final eventId = widget.event['id'] ?? widget.event['event_id'];

  if (token == null || eventId == null) return;

  final uri = isSaved
      ? Uri.parse('http://13.61.182.165:4000/delete/saved/event')
      : Uri.parse('http://13.61.182.165:4000/add/saved/event');

  final headers = {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };

  final body = json.encode({'event_id': eventId});

  final response = isSaved
      ? await http.delete(uri, headers: headers, body: body)
      : await http.post(uri, headers: headers, body: body);

  if (response.statusCode == 200) {
    setState(() {
      isSaved = !isSaved;
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(isSaved ? 'Event saved.' : 'Event removed from saved.'),
    ));
        Navigator.pop(context);
  } else {
    debugPrint('Save toggle failed: ${response.body}');
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('Failed to update saved status'),
    ));
        Navigator.pop(context);
  }
}


  Future<void> _registerForEvent() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final eventId = widget.event['id'] ?? widget.event['event_id'];

    if (token == null || eventId == null) return;

    final response = await http.post(
      Uri.parse('http://13.61.182.165:4000/add_registration'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: json.encode({'event_id': eventId}),
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Successfully registered for the event')),
      );
      Navigator.pop(context);
    } else {
      debugPrint('Register error: ${response.body}');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to register')),
      );
      Navigator.pop(context);
    }
  }

  Future<void> _unregisterFromEvent() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final eventId = widget.event['id'] ?? widget.event['event_id'];

    if (token == null || eventId == null) return;

    final response = await http.delete(
      Uri.parse('http://13.61.182.165:4000/delete_register?event_id=$eventId'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You have left the event')),
      );
      Navigator.pop(context);
    } else {
      debugPrint('Unregister error: ${response.body}');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to leave event')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final String title = event['event_title'] ?? 'No Title';
    final String imageUrl = event['event_image'] ?? '';
    final String description = event['event_description'] ?? 'No description provided.';
    final String location = event['location']?['place_name'] ?? event['event_location'] ?? 'Location unavailable';
    final int participants = event['number_places_available'] ?? 0;
    final int registrations = event['number_of_registrations'] ?? 0;
    final String organizer = event['organizer'] ?? 'Unknown Organizer';

    DateTime? eventDate;
    String month = '', dayNumber = '', dayName = '', time = '';
    final rawDate = event['event_date'] ?? event['time'];
    if (rawDate != null) {
      try {
        eventDate = DateTime.parse(rawDate);
        month = DateFormat('MMM').format(eventDate).toUpperCase();
        dayNumber = DateFormat('d').format(eventDate);
        dayName = DateFormat('EEEE').format(eventDate);
        time = DateFormat('h:mm a').format(eventDate);
      } catch (e) {
        debugPrint('Date parsing error: $e');
      }
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Column(
        children: [
          Stack(
            children: [
              Hero(
                tag: imageUrl,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(40)),
                  child: Image.network(
                    imageUrl,
                    width: double.infinity,
                    height: 350,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 350,
                      color: Colors.grey[800],
                      child: const Center(
                        child: Icon(Icons.broken_image, size: 60, color: Colors.white54),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 50,
                left: 20,
                child: CircleAvatar(
                  backgroundColor: Colors.black.withOpacity(0.5),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ),
              Positioned(
                top: 50,
                right: 20,
                child: CircleAvatar(
                  backgroundColor: Colors.black.withOpacity(0.5),
                  child: IconButton(
                    icon: Icon(
                      isSaved ? Icons.bookmark : Icons.bookmark_border,
                      color: isSaved ? Colors.red : Colors.greenAccent,
                    ),
                    onPressed: _toggleSaveEvent,
                  ),
                ),
              ),
              Positioned(
                bottom: 20,
                left: 20,
                right: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        organizer,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Colors.white70, size: 16),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            location,
                            style: const TextStyle(color: Colors.white70),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xFF121212),
                borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (eventDate != null)
                    Row(
                      children: [
                        Container(
                          width: 70,
                          height: 70,
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.greenAccent.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(month, style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 14)),
                              Text(dayNumber, style: const TextStyle(fontSize: 24, color: Colors.white, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: SizedBox(
                            height: 70,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(dayName, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500)),
                                const SizedBox(height: 4),
                                Text(time, style: const TextStyle(color: Colors.white70, fontSize: 14)),
                              ],
                            ),
                          ),
                        ),
                        Container(
                          width: 50,
                          height: 70,
                          alignment: Alignment.centerRight,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.greenAccent.withOpacity(0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.calendar_month, color: Colors.greenAccent, size: 32),
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.people, size: 20, color: Colors.white70),
                          const SizedBox(width: 6),
                          Text('Registered $registrations / $participants', style: const TextStyle(color: Colors.white70)),
                        ],
                      ),
                      ElevatedButton(
                        onPressed: isLoading
                            ? null
                            : () {
                                if (isRegistered) {
                                  _unregisterFromEvent();
                                } else {
                                  _registerForEvent();
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isRegistered ? Colors.redAccent : Colors.greenAccent,
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        ),
                        child: Text(
                          isRegistered ? 'Leave' : 'Join Now',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Description', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Text(description, style: const TextStyle(color: Colors.white70, height: 1.4)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

