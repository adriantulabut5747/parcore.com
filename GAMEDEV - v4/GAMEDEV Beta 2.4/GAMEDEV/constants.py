#All game constants
import random

# Class list
CLASSES = ["Warrior", "Mage", "Rogue", "Cleric", "Ranger"]

# Mage elements
MAGE_ELEMENTS = ["Fire", "Ice", "Water", "Lightning", "Dark", "Earth"]

# Follower names for buff system
FOLLOWER_NAMES = ["Andrei", "Adrian", "Ahron", "Dexter", "Kurt", "Seddy", "Vi"]

# Combat constants
ULTIMATE_COOLDOWN_TURNS = 4
BOSS_SPAWN_CHANCE = 0.07  # 5% chance for boss
BOSS_SPECIAL_ATTACK_CHANCE = 0.1  # 10% chance for boss special

# Resource costs
BASIC_ATTACK_COST = 10
MAGIC_ATTACK_COST = 10
HEAL_COST = 15

# Resource regeneration
STAMINA_REGEN_MIN = 3
STAMINA_REGEN_MAX = 8
MP_REGEN_MIN = 2
MP_REGEN_MAX = 6

# Stat limits
MIN_STAT = 1
MAX_DEFENSE_REDUCTION = 5