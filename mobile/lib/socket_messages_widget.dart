class SocketMessagesWidget extends StatefulWidget {
  const SocketMessagesWidget({super.key});

  @override
  State<SocketMessagesWidget> createState() => _SocketMessagesWidgetState();
}

class _SocketMessagesWidgetState extends State<SocketMessagesWidget> {
  final List<String> messages = [];

  @override
  void initState() {
    super.initState();
    WebSocketService().stream.listen((msg) {
      setState(() {
        messages.insert(0, msg); // Most recent first
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: messages.length,
      itemBuilder: (context, index) {
        return ListTile(
          title: Text("📨 ${messages[index]}"),
        );
      },
    );
  }
}
