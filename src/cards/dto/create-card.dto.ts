export class CreateCardDto {
  name: string;
  image?: string;
  power: number;
  speed: number;
  intelligence: number;
  defense: number;
  agility: number;
  description?: string;
  rarity?: string;
}
