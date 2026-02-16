import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class UpdatePage extends StatefulWidget {
  final Map<String, dynamic> event;

  const UpdatePage({super.key, required this.event});

  @override
  State<UpdatePage> createState() => _UpdatePageState();
}

class _UpdatePageState extends State<UpdatePage> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();

  String? _title, _description, _location;
  int? _maxPlaces;
  DateTime? _date;
  TimeOfDay? _time;
  File? _image;
  String? _existingImageUrl;

  @override
  void initState() {
    super.initState();
    _title = widget.event['event_title'];
    _description = widget.event['event_description'];
    _location = widget.event['location']['place_name'];
    _maxPlaces = widget.event['max_places'];
    _existingImageUrl = widget.event['event_image'];

    // Parse date and time from event_date
    try {
      final dateTime = DateTime.parse(widget.event['event_date']);
      _date = dateTime;
      _time = TimeOfDay(hour: dateTime.hour, minute: dateTime.minute);
    } catch (_) {}
  }

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() {
        _image = File(picked.path);
        _existingImageUrl = null;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time ?? TimeOfDay.now(),
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _date == null || _time == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields and pick date & time.')),
      );
      return;
    }

    _formKey.currentState!.save();

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) throw Exception('Token not found');

      final uri = Uri.parse('http://13.61.182.165:4000/events/Edit');
      final request = http.MultipartRequest('PUT', uri)
        ..headers['authorization'] = 'Bearer $token'
        ..fields['event_id'] = widget.event['event_id'].toString()
        ..fields['title'] = _title!
        ..fields['description'] = _description!
        ..fields['location'] = _location!
        ..fields['max_places'] = _maxPlaces.toString()
        ..fields['date'] = _date!.toIso8601String().split('T')[0]
        ..fields['time'] = _time!.format(context);

      if (_image != null) {
        request.files.add(await http.MultipartFile.fromPath('image', _image!.path));
      }

      final response = await request.send();

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Event updated successfully!')),
        );
        Navigator.pop(context); // Return to previous screen
        Navigator.pop(context);
        Navigator.pop(context); // 🔁 Go back twice
      } else {
        final respStr = await response.stream.bytesToString();
        throw Exception('Error: $respStr');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text("Update Event"),
        backgroundColor: Colors.black,
        actions: [
          IconButton(
            icon: const Icon(Icons.save, color: Colors.greenAccent),
            onPressed: _submit,
            tooltip: 'Update Event',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Image preview or picker
              GestureDetector(
                onTap: _pickImage,
                child: Container(
                  height: 180,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white24),
                    color: Colors.grey[900],
                    image: _image != null
                        ? DecorationImage(image: FileImage(_image!), fit: BoxFit.cover)
                        : (_existingImageUrl != null
                            ? DecorationImage(
                                image: NetworkImage(_existingImageUrl!),
                                fit: BoxFit.cover)
                            : null),
                  ),
                  child: (_image == null && _existingImageUrl == null)
                      ? const Center(
                          child: Text('Tap to pick an image',
                              style: TextStyle(color: Colors.white54)))
                      : null,
                ),
              ),
              const SizedBox(height: 20),

              _buildTextField('Title', (val) => _title = val, initialValue: _title),
              const SizedBox(height: 14),

              _buildTextField('Description', (val) => _description = val,
                  maxLines: 3, initialValue: _description),
              const SizedBox(height: 14),

              _buildTextField('Location', (val) => _location = val, initialValue: _location),
              const SizedBox(height: 14),

              TextFormField(
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Max Places'),
                keyboardType: TextInputType.number,
                initialValue: _maxPlaces?.toString(),
                validator: (val) {
                  final n = int.tryParse(val ?? '');
                  if (n == null || n <= 0) return 'Enter valid number';
                  return null;
                },
                onSaved: (val) => _maxPlaces = int.tryParse(val!),
              ),
              const SizedBox(height: 20),

              // Date and Time pickers
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.date_range),
                      label: Text(
                        _date == null
                            ? 'Pick Date'
                            : '${_date!.day}/${_date!.month}/${_date!.year}',
                      ),
                      onPressed: _pickDate,
                      style: _elevatedButtonStyle(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.access_time),
                      label: Text(
                        _time == null ? 'Pick Time' : _time!.format(context),
                      ),
                      onPressed: _pickTime,
                      style: _elevatedButtonStyle(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white70),
      enabledBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.white30),
      ),
      focusedBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.greenAccent),
      ),
    );
  }

  Widget _buildTextField(
    String label,
    void Function(String?) onSaved, {
    int maxLines = 1,
    String? initialValue,
  }) {
    return TextFormField(
      initialValue: initialValue,
      style: const TextStyle(color: Colors.white),
      decoration: _inputDecoration(label),
      maxLines: maxLines,
      validator: (val) => (val == null || val.isEmpty) ? 'Enter $label' : null,
      onSaved: onSaved,
    );
  }

  ButtonStyle _elevatedButtonStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: Colors.blueAccent,
      foregroundColor: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      textStyle: const TextStyle(fontWeight: FontWeight.w600),
    );
  }
}
