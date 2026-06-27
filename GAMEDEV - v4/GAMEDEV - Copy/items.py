# Item and equipment system

import random

WEAPONS = [
    ("Iron Sword", {"attack": 8, "magic_attack": 0, "defense": 2, "magic_defense": 0, "speed": 0}),
    ("Steel Blade", {"attack": 12, "magic_attack": 0, "defense": 3, "magic_defense": 0, "speed": 0}),
    ("Great Sword", {"attack": 20, "magic_attack": 0, "defense": 5, "magic_defense": 0, "speed": -5}),
    ("Dagger", {"attack": 5, "magic_attack": 0, "defense": 0, "magic_defense": 0, "speed": 8}),
    ("Elder Staff", {"attack": 4, "magic_attack": 20, "defense": 2, "magic_defense": 4, "speed": -3}),
    ("Wizard's Wand", {"attack": 3, "magic_attack": 12, "defense": 0, "magic_defense": 3, "speed": 2}),
    ("Bow", {"attack": 10, "magic_attack": 0, "defense": 1, "magic_defense": 0, "speed": 1}),
    ("Dragon Slayer", {"attack": 25, "magic_attack": 5, "defense": 8, "magic_defense": 2, "speed": -8}),
    ("Hermes' Talaria", {"attack": 1, "magic_attack": 1, "defense": 4, "magic_defense": 6, "speed": 15}),
    ("Shadow Blade", {"attack": 15, "magic_attack": 5, "defense": 3, "magic_defense": 3, "speed": 4}),
    ("Athensa's Aegis", {"attack": 1, "magic_attack": 0, "defense": 30, "magic_defense": 30, "speed": -15}),
]

def get_random_weapon():
    """Return a random weapon from the database"""
    return random.choice(WEAPONS)