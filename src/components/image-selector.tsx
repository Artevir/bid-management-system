'use client';

/**
 * 图片选择器组件
 * 用于从多个图片中选择一张或多张
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePreview } from '@/components/image-preview';
import { Check } from 'lucide-react';

// ============================================
// 组件属性
// ============================================

interface ImageSelectorProps {
  images: string[];
  selectedImages: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  maxSelection?: number;
}

// ============================================
// 主组件
// ============================================

export function ImageSelector({
  images,
  selectedImages,
  onChange,
  multiple = false,
  maxSelection,
}: ImageSelectorProps) {
  // 选择图片
  const handleSelect = (imageUrl: string) => {
    if (multiple) {
      // 多选模式
      let newSelected: string[];

      if (selectedImages.includes(imageUrl)) {
        // 取消选择
        newSelected = selectedImages.filter((url) => url !== imageUrl);
      } else {
        // 添加选择（检查最大选择数量）
        if (maxSelection && selectedImages.length >= maxSelection) {
          return; // 已达最大选择数量
        }
        newSelected = [...selectedImages, imageUrl];
      }

      onChange(newSelected);
    } else {
      // 单选模式
      onChange([imageUrl]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {images.map((imageUrl, index) => {
          const isSelected = selectedImages.includes(imageUrl);
          return (
            <div
              key={index}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
              }`}
              onClick={() => handleSelect(imageUrl)}
            >
              {/* 选中标记 */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              {/* 图片预览 */}
              <ImagePreview
                src={imageUrl}
                alt={`图片 ${index + 1}`}
                width={200}
                height={150}
                showActions={false}
              />
            </div>
          );
        })}
      </div>

      {/* 提示信息 */}
      {multiple && maxSelection && (
        <p className="text-sm text-gray-500 text-center">
          已选择 {selectedImages.length} / {maxSelection} 张图片
        </p>
      )}
    </div>
  );
}
