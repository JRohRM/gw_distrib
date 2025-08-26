#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Dépendances à installer (avec RPi connecté):
    sudo apt update
    sudo apt install python3-pip python3-rpi.gpio sqlite3 -y
    pip3 install mfrc522

Câblage MFRC522 typique (BCM):
    SDA -> CE0 (GPIO8)
    SCK -> SCLK (GPIO11)
    MOSI -> MOSI (GPIO10)
    MISO -> MISO (GPIO9)
    IRQ -> (non utilisé)
    GND -> GND
    RST -> GPIO25 (par défaut dans les libs)
    3.3V -> 3.3V

Exécution:
    sudo python3 rfid_gate.py
"""

import os
import time
import sqlite3
from datetime import datetime
import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522

# ======== Paramètres modifiables ========
BASE_DIR      = os.path.dirname(os.path.realpath(__file__))
DB_PATH       = os.path.join(BASE_DIR, "rfid_gate.sqlite3")
GPIO_OUT_PIN   = 17           # Broche BCM à alimenter si OK
PULSE_SECONDS  = 2.0          # Durée d'alimentation du GPIO
ANTISPAM_SEC   = 2.0          # Ignore un même UID si re-détecté trop vite
# ========================================

def init_db(conn):
    cur = conn.cursor()
    cur.execute("""
CREATE TABLE IF NOT EXISTS cards (
uid TEXT PRIMARY KEY,
created_at TEXT DEFAULT (datetime('now','localtime'))
);
    """)
    cur.execute("""
CREATE TABLE IF NOT EXISTS scans (
id   INTEGER PRIMARY KEY AUTOINCREMENT,
uid  TEXT NOT NULL,
ts   TEXT  DEFAULT (datetime('now','localtime')),
FOREIGN KEY(uid) REFERENCES cards(uid)
);
    """)
    conn.commit()

def ensure_card_exists(conn, uid):
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM cards WHERE uid = ?", (uid,))
    if cur.fetchone() is None:
        cur.execute("INSERT INTO cards(uid) VALUES(?)", (uid,))
        conn.commit()
        print(f"[INFO] Nouvelle carte enregistrée: {uid}")

def log_scan(conn, uid):
    cur = conn.cursor()
    cur.execute("INSERT INTO scans(uid) VALUES(?)", (uid,))
    conn.commit()

def today_scan_count(conn, uid):
    cur = conn.cursor()
    # Compte les scans pour la date locale du jour
    cur.execute("""
SELECT COUNT(*) FROM scans
WHERE uid = ?
AND date(ts) = date('now','localtime')
        """, (uid,))
    (count,) = cur.fetchone()
    return count

def pulse_gpio(pin, seconds):
    GPIO.output(pin, GPIO.HIGH)
    time.sleep(seconds)
    GPIO.output(pin, GPIO.LOW)

def main():
    # GPIO setup
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(GPIO_OUT_PIN, GPIO.OUT, initial=GPIO.LOW)

    # DB setup
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    init_db(conn)

    # Lecteur RFID
    reader = SimpleMFRC522()

    print("[READY] Présentez une carte RFID (Ctrl+C pour quitter).")

    last_uid = None
    last_time = 0.0

    try:
        while True:
            try:
                uid_num, _ = reader.read()  # bloquant jusqu'à lecture
                uid = str(uid_num).strip()

                now = time.time()
                # Anti-spam: ignore si même carte scannée trop vite
                if uid == last_uid and (now - last_time) < ANTISPAM_SEC:
                    time.sleep(0.2)
                    continue

                last_uid = uid
                last_time = now

                print(f"\n[SCAN] UID={uid} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

                # 1) Enregistrer la carte si inconnue
                ensure_card_exists(conn, uid)

                # 2) Log du scan (chaque passage est enregistré)
                log_scan(conn, uid)

                # 3) Compter les scans du jour pour cette carte (incluant celui-ci)
                cnt = today_scan_count(conn, uid)
                print(f"[INFO] Nombre de scans aujourd'hui pour {uid}: {cnt}")

                # 4) Activer le GPIO si la carte n'a pas été scannée plus de 3 fois
                #    -> autorisé si cnt <= 3
                if cnt <= 3:
                    print(f"[GPIO] Autorisé (scan {cnt}/3). Activation du GPIO {GPIO_OUT_PIN} pendant {PULSE_SECONDS}s.")
                    pulse_gpio(GPIO_OUT_PIN, PULSE_SECONDS)
                else:
                    print(f"[GPIO] Refusé: la carte a déjà été scannée plus de 3 fois aujourd'hui.")

                # Petit délai pour laisser le temps de retirer la carte
                time.sleep(0.5)

            except Exception as e:
                # Évite de bloquer la boucle sur une erreur de lecture ponctuelle
                print(f"[WARN] Erreur de lecture: {e}")
                time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n[EXIT] Arrêt demandé par l'utilisateur.")
    finally:
        try:
            GPIO.output(GPIO_OUT_PIN, GPIO.LOW)
        except Exception:
            pass
        GPIO.cleanup()
        conn.close()
        print("[CLEAN] GPIO nettoyés et base fermée.")

if __name__ == "__main__":
    main()