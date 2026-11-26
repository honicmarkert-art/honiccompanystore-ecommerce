import fs from 'fs'
import path from 'path'

const images = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'xinde-scraped-images.json'), 'utf8'))

const CATALOG = [
  {
    taobaoId: '541977731065',
    nameEn: 'DuPont Jumper Wires M-M M-F F-F 10cm to 40cm',
    priceTzs: 1500,
    categoryKey: 'cables',
    model: 'DUPONT-WIRE',
    description:
      'Ribbon jumper wires for breadboard prototyping: male-to-male, male-to-female, and female-to-female in 10–40 cm lengths. Works with Arduino, ESP32, and Raspberry Pi projects.',
    specifications: { Type: 'DuPont jumper cable', Lengths: '10, 15, 20, 30, 40 cm options', Connector: '2.54 mm dupont' },
  },
  {
    taobaoId: '38140937609',
    nameEn: '400-Point Breadboard with 65 Jumper Wires Kit',
    priceTzs: 5500,
    categoryKey: 'accessories',
    model: 'BB-400',
    description: 'Solderless 400-hole breadboard plus jumper wire set for Arduino/ESP32 prototypes and student labs.',
    specifications: { Holes: '400', Includes: 'Breadboard + jumper wires' },
  },
  {
    taobaoId: '525749206437',
    nameEn: '5V Relay Module 1-8 Channel Optocoupler for Arduino ESP32',
    priceTzs: 4500,
    categoryKey: 'accessories',
    model: 'RELAY-MOD',
    description: 'Low-level or high-level trigger relay board with optocoupler isolation. Choose channel count and coil voltage for lamps, pumps, and automation.',
    specifications: { Isolation: 'Optocoupler', Trigger: 'High/low level', Voltage: '5V/9V/12V/24V variants' },
  },
  {
    taobaoId: '36584610657',
    nameEn: 'HC-SR501 PIR Motion Sensor Module',
    priceTzs: 5500,
    categoryKey: 'sensors',
    model: 'HC-SR501',
    description: 'Passive infrared motion detector module for alarms, automatic lighting, and occupancy projects with Arduino or ESP32.',
    specifications: { Sensor: 'PIR motion', Output: 'Digital TTL', Supply: '5V–20V DC' },
  },
  {
    taobaoId: '38316710943',
    nameEn: 'LCD1602 LCD2004 12864 I2C Serial Display Module 5V',
    priceTzs: 7000,
    categoryKey: 'accessories',
    model: 'LCD-I2C',
    description: 'Character/graphic LCD with I2C backpack for easy 2-wire hookup to Arduino, ESP32, and Pi.',
    specifications: { Interface: 'I2C', Voltage: '5V', Types: '1602A / 2004A / 12864' },
  },
  {
    taobaoId: '37717306166',
    nameEn: 'GY-521 MPU-6050 6DOF IMU Accelerometer Gyro Module',
    priceTzs: 8000,
    categoryKey: 'sensors',
    model: 'MPU-6050',
    description: 'Triple-axis accelerometer + gyroscope on one I2C module for drones, robots, and motion tracking.',
    specifications: { Chip: 'MPU-6050', Interface: 'I2C', DOF: '6' },
  },
  {
    taobaoId: '37984321649',
    nameEn: 'HC-SR04 Ultrasonic Distance Sensor Module',
    priceTzs: 6500,
    categoryKey: 'sensors',
    model: 'HC-SR04',
    description: 'Ultrasonic ranger for obstacle detection, tank level, and robotics. Compatible with UNO, ESP32, STM32.',
    specifications: { Range: '2–400 cm typ.', Interface: 'Trigger/Echo', Voltage: '5V' },
  },
  {
    taobaoId: '609274329872',
    nameEn: 'TB6612FNG Dual DC Motor Driver Module',
    priceTzs: 6000,
    categoryKey: 'motors',
    model: 'TB6612',
    description: 'Compact two-motor H-bridge driver for robots and carts; higher efficiency than L298N for small motors.',
    specifications: { Driver: 'TB6612FNG', Motors: '2x DC', Logic: '3.3V/5V' },
  },
  {
    taobaoId: '547757363713',
    nameEn: '0.96 Inch OLED Display 128x64 I2C SSD1306 Module',
    priceTzs: 19000,
    categoryKey: 'accessories',
    model: 'OLED-0.96',
    description: 'White/blue/yellow-blue 0.96" OLED with I2C for status screens on ESP32 and Arduino wearables.',
    specifications: { Size: '0.96 inch', Resolution: '128×64', Interface: 'I2C' },
  },
  {
    taobaoId: '633743549664',
    nameEn: 'HC-05 HC-06 Bluetooth Serial Module for Arduino ESP32',
    priceTzs: 15000,
    categoryKey: 'accessories',
    model: 'HC-05',
    description: 'Classic UART Bluetooth module for wireless serial links, app control, and data logging.',
    specifications: { Interface: 'UART TTL', Profile: 'Bluetooth 2.0 SPP', Voltage: '3.3V–5V' },
  },
]

const batch = CATALOG.map((c) => ({
  ...c,
  imageUrls: images[c.taobaoId] || [],
}))

fs.writeFileSync(path.join(import.meta.dirname, 'xinde-batch-10-data.json'), JSON.stringify(batch, null, 2))
console.log('Wrote', batch.length, 'items to xinde-batch-10-data.json')