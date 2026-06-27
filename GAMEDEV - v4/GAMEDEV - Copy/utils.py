#Por Utility functions

import time
import random


def loading_sequence(message, duration=1.5):
    print(message, end="", flush=True)
    dots = 4
    for _ in range(dots):
        time.sleep(duration / dots)
        print(".", end="", flush=True)
    time.sleep(0.3)
    print()

def calculate_damage(base_damage, defense, variance_range=(-5, 8)):
    variance = random.randint(variance_range[0], variance_range[1])
    damage = base_damage + variance
    actual_damage = max(1, damage - defense)
    return actual_damage

def clamp(value, min_value, max_value):
    """Clamp a value between min and max"""
    return max(min_value, min(value, max_value))