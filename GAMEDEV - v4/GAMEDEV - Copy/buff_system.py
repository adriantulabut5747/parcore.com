#Por buffs nganiiii

import random
from constants import CLASSES, FOLLOWER_NAMES

class BuffFollower:
    def __init__(self, class_name):
        self.class_name = class_name
        self.stats = self.get_buff_stats()
    
    def get_buff_stats(self):
        if self.class_name == "Warrior":
            return {"attack": 5, "defense": 3}
        elif self.class_name == "Mage":
            return {"magic_attack": 8, "magic_defense": 2}
        elif self.class_name == "Rogue":
            return {"attack": 3, "speed": 5}
        elif self.class_name == "Cleric":
            return {"defense": 2, "magic_defense": 4}
        elif self.class_name == "Ranger":
            return {"attack": 4, "speed": 3}
        return {"attack": 2, "defense": 2}
    
    def apply_buff(self, player, follower_name):
        """Apply buff stats to player with named follower"""
        print(f"[BUFF] A {self.class_name} joins your party temporarily!")
        for stat, value in self.stats.items():
            if stat == "attack":
                player.base_attack += value
                print(f"  +{value} Attack")
            elif stat == "defense":
                player.base_defense += value
                print(f"  +{value} Defense")
            elif stat == "magic_attack":
                player.base_magic_attack += value
                print(f"  +{value} Magic Attack")
            elif stat == "magic_defense":
                player.base_magic_defense += value
                print(f"  +{value} Magic Defense")
            elif stat == "speed":
                player.base_speed += value
                print(f"  +{value} Speed")
        print(f"[ALLY] {follower_name} The {self.class_name} fights alongside you for a while!")

def get_random_follower():
    """Generate a random follower with name and class"""
    follower_class = random.choice(CLASSES)
    follower_name = random.choice(FOLLOWER_NAMES)
    return follower_name, follower_class