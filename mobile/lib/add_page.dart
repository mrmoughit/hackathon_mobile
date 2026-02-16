import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AddPage extends StatefulWidget {
  const AddPage({super.key});

  @override
  State<AddPage> createState() => _AddPageState();
}

class _AddPageState extends State<AddPage> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();

  String? _title, _description, _location;
  int? _maxPlaces;
  DateTime? _date;
  TimeOfDay? _time;
  File? _image;

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) setState(() => _image = File(picked.path));
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _image == null || _date == null || _time == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields and pick image, date, and time.')),
      );
      return;
    }

    _formKey.currentState!.save();

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) throw Exception('Token not found');

      final uri = Uri.parse('http://13.61.182.165:4000/addevent');
      final request = http.MultipartRequest('POST', uri)
        ..headers['Authorization'] = 'Bearer $token'
        ..fields['title'] = _title!
        ..fields['description'] = _description!
        ..fields['location'] = _location!
        ..fields['max_places'] = _maxPlaces.toString()
        ..fields['date'] = _date!.toIso8601String().split('T')[0]
        ..fields['time'] = _time!.format(context)
        ..files.add(await http.MultipartFile.fromPath('image', _image!.path));

      final response = await request.send();

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🎉 Event created successfully!')),
        );
        setState(() {
          _formKey.currentState!.reset();
          _image = null;
          _date = null;
          _time = null;
        });
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
        title: const Text("Add Event"),
        backgroundColor: Colors.black,
        actions: [
          IconButton(
            icon: const Icon(Icons.check_circle, color: Colors.greenAccent),
            onPressed: _submit,
            tooltip: 'Create Event',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Image Picker
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
                        : null,
                  ),
                  child: _image == null
                      ? const Center(
                          child: Text('Tap to pick an image',
                              style: TextStyle(color: Colors.white54)))
                      : null,
                ),
              ),
              const SizedBox(height: 20),

              // Title
              _buildTextField('Title', (val) => _title = val),
              const SizedBox(height: 14),

              // Description
              _buildTextField('Description', (val) => _description = val,
                  maxLines: 3),
              const SizedBox(height: 14),

              // Location
              _buildTextField('Location', (val) => _location = val),
              const SizedBox(height: 14),

              // Max Places
              TextFormField(
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Max Places'),
                keyboardType: TextInputType.number,
                validator: (val) {
                  final n = int.tryParse(val ?? '');
                  if (n == null || n <= 0) return 'Enter valid number';
                  return null;
                },
                onSaved: (val) => _maxPlaces = int.tryParse(val!),
              ),
              const SizedBox(height: 20),

              // Date and Time
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

  Widget _buildTextField(String label, void Function(String?) onSaved,
      {int maxLines = 1}) {
    return TextFormField(
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
