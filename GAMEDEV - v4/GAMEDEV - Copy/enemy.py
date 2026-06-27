# mob related chuchu

import random

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
                print(f"[DEBUFF] {self.name} is disoriented and cannot act!")
                if self.turns_affected >= self.debuff.get("duration", 3):
                    print(f"[DEBUFF] {self.name}'s {self.debuff['type']} effect wears off!")
                    self.debuff = None
                    self.turns_affected = 0
                return True  

        if self.debuff["type"] in ["bleed", "poison", "burn", "drown"]:
            damage = self.debuff.get("damage", 8)
            self.hp -= damage
            print(f"[DEBUFF] {self.name} takes {damage} {self.debuff['type']} damage!")
            if self.hp <= 0:
                return False
            
        elif self.debuff["type"] in ["freeze", "slow"]:
            if self.debuff.get("effect") == "speed_reduced":
                print(f"[DEBUFF] {self.name} is slowed and attacks weaker!")
                self.attack = max(5, self.attack - 5)
            
        elif self.debuff["type"] == "crush":
            if self.debuff.get("effect") == "defense_reduced":
                print(f"[DEBUFF] {self.name}'s defense is reduced!")
                self.defense = max(1, self.defense - 5)
    
        if self.turns_affected >= self.debuff.get("duration", 3):
            print(f"[DEBUFF] {self.name}'s {self.debuff['type']} effect wears off!")
            self.debuff = None
            self.turns_affected = 0
        
        return False

# Enemy databases
#stats chuchu - name, hp, atk, matk, def, mdef, spd, exp, boss
NORMAL_ENEMIES = {
    "Slime": Enemy("Slime", 40, 10, 6, 8, 6, 5, 45),
    "Goblin": Enemy("Goblin", 55, 15, 8, 5, 4, 12, 60),
    "Wolf": Enemy("Wolf", 50, 18, 10, 6, 5, 16, 65),
    "Skeleton": Enemy("Skeleton", 65, 20, 12, 8, 6, 10, 75),
    "Dark Elf": Enemy("Dark Elf", 70, 22, 25, 8, 12, 18, 90),
    "Orc": Enemy("Orc", 90, 28, 8, 12, 6, 8, 100),
}

BOSS_ENEMIES = {
    "Death Knight": Enemy("Death Knight", 200, 35, 15, 18, 12, 20, 350, True),
    "Dark Magician": Enemy("Dark Magician", 160, 22, 45, 10, 20, 28, 400, True),
    "Black King": Enemy("Black King", 300, 45, 25, 25, 18, 18, 600, True),
    "Ancient Dragon": Enemy("Ancient Dragon", 400, 55, 35, 30, 25, 32, 800, True),
}