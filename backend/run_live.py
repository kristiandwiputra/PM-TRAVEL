"""Run the API and its MQTT receiver together for local live monitoring."""
import argparse
import socket


def port_available(host, port):
    probe_host = '127.0.0.1' if host == '0.0.0.0' else '::1' if host == '::' else host
    try:
        with socket.create_connection((probe_host, port), timeout=1):
            return False
    except OSError:
        return True


def main(argv=None):
    parser = argparse.ArgumentParser(description='PM-TRAVEL: jalankan API dan penerima MQTT sekaligus.')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error('Port harus berada antara 1 dan 65535.')
    if not port_available(args.host, args.port):
        parser.error('Port API sudah digunakan. Hentikan API lama, atau jalankan mqtt_subscriber.py saja.')

    import uvicorn
    from database import settings
    from mqtt_subscriber import create_client

    client = create_client()
    client.connect_async(settings.mqtt_host, settings.mqtt_port, keepalive=60)
    client.loop_start()
    try:
        uvicorn.run('main:app', host=args.host, port=args.port, access_log=False)
    finally:
        client.disconnect()
        client.loop_stop()


if __name__ == '__main__':
    main()
