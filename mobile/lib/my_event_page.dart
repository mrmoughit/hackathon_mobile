import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'update_page.dart';

class MyEventPage extends StatefulWidget {
  final Map<String, dynamic> event;
  const MyEventPage({super.key, required this.event});

  @override
  State<MyEventPage> createState() => _MyEventPageState();
}

class _MyEventPageState extends State<MyEventPage> {
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
                    children: [
                      const Icon(Icons.people, size: 20, color: Colors.white70),
                      const SizedBox(width: 6),
                      Text('Registered $registrations / $participants', style: const TextStyle(color: Colors.white70)),
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
                  const SizedBox(height: 16),
                  Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton.icon(
                          onPressed: _updateEvent,
                          icon: const Icon(Icons.edit, size: 16),
                          label: const Text("Update", style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orangeAccent,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          onPressed: _finishEvent,
                          icon: const Icon(Icons.check_circle, size: 16),
                          label: const Text("Finish", style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blueAccent,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          onPressed: _deleteEvent,
                          icon: const Icon(Icons.delete, size: 16),
                          label: const Text("Delete", style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.redAccent,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteEvent() async {
    final eventId = widget.event['_id'] ?? widget.event['event_id'];
    if (eventId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event ID missing')));
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Not authenticated')));
        return;
      }

      final response = await http.delete(
        Uri.parse('http://13.61.182.165:4000/events_delete'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'event_id': eventId}),
      );

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event deleted')));
        Navigator.pop(context);
        Navigator.pop(context); // 🔁 Go back twice
      } else {
        debugPrint('Delete failed: ${response.body}');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to delete: ${response.reasonPhrase}')));
      }
    } catch (e) {
      debugPrint('Error during delete: $e');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('An error occurred')));
    }
  }

  Future<void> _finishEvent() async {
    final eventId = widget.event['_id'] ?? widget.event['event_id'];
    if (eventId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event ID missing')));
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Not authenticated')));
        return;
      }

      final uri = Uri.parse('http://13.61.182.165:4000/events_finish');
      final request = http.Request('POST', uri)
        ..headers.addAll({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        })
        ..body = jsonEncode({'event_id': eventId});

      final response = await request.send();
      final responseBody = await response.stream.bytesToString();

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Event marked as finished')));
        Navigator.pop(context);
        Navigator.pop(context); // 🔁 Go back twice
      } else {
        debugPrint('Finish failed: $responseBody');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to finish: ${response.reasonPhrase}')));
      }
    } catch (e) {
      debugPrint('Error during finish: $e');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('An error occurred')));
    }
  }

  void _updateEvent() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => UpdatePage(event: widget.event),
      ),
    );
  }
}
