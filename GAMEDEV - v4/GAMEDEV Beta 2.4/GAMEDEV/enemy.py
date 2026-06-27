# mob related chuchu

import random
from ui import Colors

class Enemy:
    def __init__(self, name, hp, attack, magic_attack, defense, magic_defense, speed, exp_reward, is_boss=False):
        self.name = name
        self.hp = hp
        self.max_hp = hp
        self.attack = attack
        self.magic_attack = magic_attack
        self.defense = defense
        self.magic_defense = magic_defense
        self.speed = speed
        self.exp_reward = exp_reward
        self.is_boss = is_boss
        self.debuff = None
        self.turns_affected = 0

    def copy(self):
        return Enemy(
            self.name, 
            self.max_hp,
            self.attack,
            self.magic_attack,
            self.defense, 
            self.magic_defense, 
            self.speed, 
            self.exp_reward, 
            self.is_boss
        )
    
    def apply_debuff(self):
        if not self.debuff:
            return False
    
        self.turns_affected += 1
    
        if self.debuff["type"] in ["stun", "paralyze", "blind"]:
            if self.debuff.get("effect") == "skip_turn":
                print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name} is disoriented and cannot act!")
                if self.turns_affected >= self.debuff.get("duration", 3):
                    print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name}'s {self.debuff['type']} effect wears off!")
                    self.debuff = None
                    self.turns_affected = 0
                return True  

        if self.debuff["type"] in ["bleed", "poison", "burn", "drown"]:
            damage = self.debuff.get("damage", 8)
            self.hp -= damage
            print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name} takes {damage} {self.debuff['type']} damage!")
            if self.hp <= 0:
                return False
            
        elif self.debuff["type"] in ["freeze", "slow"]:
            if self.debuff.get("effect") == "speed_reduced":
                print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name} is slowed and attacks weaker!")
                self.attack = max(5, self.attack - 5)
            
        elif self.debuff["type"] == "crush":
            if self.debuff.get("effect") == "defense_reduced":
                print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name}'s defense is reduced!")
                self.defense = max(1, self.defense - 5)
    
        if self.turns_affected >= self.debuff.get("duration", 3):
            print(f"{Colors.RED}[DEBUFF]{Colors.RESET} {self.name}'s {self.debuff['type']} effect wears off!")
            self.debuff = None
            self.turns_affected = 0
        
        return False

# Enemy databases
#stats chuchu - name, hp, atk, matk, def, mdef, spd, exp, boss
NORMAL_ENEMIES = {
    "Slime": Enemy("Slime", 69, 12, 12, 15, 8, 8, 60),
    "Dark Elf": Enemy("Dark Elf", 100, 29, 35, 13, 19, 30, 120),
    "Harpy": Enemy("Harpy", 94, 18, 35, 10, 15, 38, 110),
    "Goblin": Enemy("Goblin", 70, 22, 5, 6, 5, 16, 80),
    "Wolf": Enemy("Wolf", 65, 28, 4, 10, 8, 24, 90),
    "Skeleton": Enemy("Skeleton", 85, 32, 6, 15, 7, 12, 100),
    "Orc": Enemy("Orc", 120, 45, 3, 17, 9, 11, 140),
    "Minotaur": Enemy("Minotaur", 130, 50, 4, 20, 10, 14, 150),
    "Gargoyle": Enemy("Gargoyle", 100, 35, 5, 25, 15, 10, 130),
    "Wisp": Enemy("Wisp", 50, 4, 42, 25, 14, 28, 95),
}

BOSS_ENEMIES = {
    "Death Knight": Enemy("Death Knight", 300, 52, 30, 28, 19, 30, 525, True),
    "Lich": Enemy("Lich", 350, 40, 85, 22, 40, 35, 800, True),
    "Ruined King": Enemy("Ruined King", 450, 68, 52, 38, 28, 27, 900, True),
    "Ancient Dragon": Enemy("Ancient Dragon", 600, 82, 98, 45, 38, 58, 1200, True),
    "Hydra": Enemy("Hydra", 550, 70, 55, 35, 30, 25, 1000, True),
    "Hellhound": Enemy("Hellhound", 280, 58, 47, 22, 20, 45, 750, True),
}