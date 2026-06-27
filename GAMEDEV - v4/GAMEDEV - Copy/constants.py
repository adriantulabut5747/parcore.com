
#All game constants
import random

import os
os.system("")  # enables ANSI on older Windows

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"
RESET = "\033[0m"
BOLD = "\033[1m"
ORANGE = "\033[38;5;208m"
# Class list
CLASSES = ["Warrior", "Mage", "Rogue", "Cleric", "Ranger"]

# Mage elements
MAGE_ELEMENTS = ["Fire", "Ice", "Water", "Lightning", "Dark", "Earth"]

# Follower names for buff system
FOLLOWER_NAMES = ["Andrei", "Parcore", "Kira", "Dexter", "Kurt", "Seddy"]

# Combat constants
ULTIMATE_COOLDOWN_TURNS = 4
BOSS_SPAWN_CHANCE = 0.1  # 10% chance for boss
BOSS_SPECIAL_ATTACK_CHANCE = 0.15  # 15% chance for boss special

# Resource costs
BASIC_ATTACK_COST = 10
MAGIC_ATTACK_COST = 10
HEAL_COST = 15

# Resource regeneration
STAMINA_REGEN_PER_TURN = 5
MP_REGEN_PER_TURN = 3

# Stat limits
MIN_STAT = 1
MAX_DEFENSE_REDUCTION = 5