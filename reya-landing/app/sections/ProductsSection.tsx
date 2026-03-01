'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Leaf, Sparkles, Droplets, Sun, Star, Flower2, ArrowRight } from 'lucide-react'

const products = [
  {
    name: 'สบู่อาโวคาโด้',
    tag: 'ผิวนุ่ม ชุ่มชื้น',
    benefit: 'บำรุงผิวให้เนียนนุ่ม ชุ่มชื้น ลดริ้วรอย',
    price: '฿89',
    icon: Leaf,
    color: 'bg-green-100 text-green-700',
  },
  {
    name: 'สบู่ชาร์โคลน้ำนมฮอกไกโด',
    tag: 'ล้างสะอาด ผิวใส',
    benefit: 'ดูดซับความมัน ทำความสะอาดรูขุมขน ลดสิว',
    price: '฿99',
    icon: Droplets,
    color: 'bg-gray-100 text-gray-700',
  },
  {
    name: 'สบู่ซัลเฟอร์ลดสิว',
    tag: 'สิวหาย ผิวเนียน',
    benefit: 'ยับยั้งแบคทีเรีย ลดสิว ควบคุมความมัน',
    price: '฿79',
    icon: Sparkles,
    color: 'bg-yellow-100 text-yellow-700',
  },
  {
    name: 'สบู่แคมูแคมูวิตามินซี',
    tag: 'ผิวขาวใส กระจ่าง',
    benefit: 'ผิวขาวกระจ่างใส ลดจุดด่างดำ ต้านอนุภาคอิสระ',
    price: '฿109',
    icon: Sun,
    color: 'bg-orange-100 text-orange-700',
  },
  {
    name: 'สบู่กลูต้าโกจิกพลัส',
    tag: 'ผิวขาวกระจ่าง',
    benefit: 'ผสมกลูต้า + โกจิก ผิวขาวกระจ่างใสเร็วขึ้น',
    price: '฿119',
    icon: Star,
    color: 'bg-pink-100 text-pink-700',
  },
  {
    name: 'สบู่ฟลอรัลไฮยาลูรอนิก',
    tag: 'ผิวเด้ง อิ่มน้ำ',
    benefit: 'กักเก็บความชุ่มชื้น ผิวอิ่มฟู ลดริ้วรอย',
    price: '฿129',
    icon: Flower2,
    color: 'bg-purple-100 text-purple-700',
  },
]

export default function ProductsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="products" className="py-20 bg-cream" ref={ref}>
      <div className="section-padding max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-medium">สินค้าขายดี</span>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mt-2 mb-4">
            สบู่สูตรขายดี
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            เลือกสูตรที่ตอบโจทย์ผิวคุณ ทุกก้อนผลิตจากสมุนไพรคุณภาพ
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card group cursor-pointer"
            >
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${product.color}`}>
                <product.icon size={16} />
                {product.tag}
              </div>
              
              <div className="aspect-square bg-cream rounded-lg mb-4 flex items-center justify-center">
                <div className={`w-24 h-24 rounded-2xl ${product.color.split(' ')[0]} flex items-center justify-center`}>
                  <product.icon size={48} className={product.color.split(' ')[1]} />
                </div>
              </div>

              <h3 className="text-xl font-bold text-dark mb-2">
                {product.name}
              </h3>
              
              <p className="text-muted text-sm mb-4 line-clamp-2">
                {product.benefit}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">
                  {product.price}
                </span>
                <button className="btn-primary py-2 px-4 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  สั่งซื้อ
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-12"
        >
          <a href="#" className="inline-flex items-center gap-2 text-primary font-medium hover:gap-3 transition-all">
            ดูสินค้าทั้งหมด
            <ArrowRight size={20} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
