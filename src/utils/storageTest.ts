import { supabase } from '../lib/supabase'

export class StorageTest {
  // Test if we can list files in the photos bucket
  static async testListFiles(): Promise<boolean> {
    try {
      console.log('🧪 Testing storage list functionality...')

      const { data, error } = await supabase.storage
        .from('photos')
        .list('', { limit: 10 })

      if (error) {
        console.error('❌ Storage list failed:', error)
        return false
      }

      console.log('✅ Storage list successful:', data)
      return true
    } catch (error) {
      console.error('❌ Storage list error:', error)
      return false
    }
  }

  // Test if we can upload a small test file
  static async testUpload(): Promise<boolean> {
    try {
      console.log('🧪 Testing storage upload functionality...')

      // Create a small test file
      const testContent = 'This is a test file for storage verification'
      const testBlob = new Blob([testContent], { type: 'text/plain' })

      const testFileName = `test-${Date.now()}.txt`

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(testFileName, testBlob, {
          contentType: 'text/plain',
          cacheControl: '3600'
        })

      if (error) {
        console.error('❌ Storage upload failed:', error)
        return false
      }

      console.log('✅ Storage upload successful:', data)

      // Try to download the test file
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('photos')
        .download(testFileName)

      if (downloadError) {
        console.error('❌ Test file download failed:', downloadError)
        return false
      }

      console.log('✅ Test file download successful, size:', downloadData?.size, 'bytes')

      // Clean up the test file
      const { error: deleteError } = await supabase.storage
        .from('photos')
        .remove([testFileName])

      if (deleteError) {
        console.error('⚠️ Test file cleanup failed:', deleteError)
      } else {
        console.log('✅ Test file cleaned up successfully')
      }

      return true
    } catch (error) {
      console.error('❌ Storage upload test error:', error)
      return false
    }
  }

  // Test if we can access the photos bucket
  static async testBucketAccess(): Promise<boolean> {
    try {
      console.log('🧪 Testing photos bucket access...')

      // Try to get bucket info
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

      if (bucketsError) {
        console.error('❌ Bucket list failed:', bucketsError)
        return false
      }

      const photosBucket = buckets?.find(bucket => bucket.name === 'photos')
      console.log('📁 Photos bucket found:', photosBucket)

      if (!photosBucket) {
        console.error('❌ Photos bucket not found')
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Bucket access test error:', error)
      return false
    }
  }

  // Run all storage tests
  static async runAllTests(): Promise<void> {
    console.log('🧪 Running storage tests...')

    const bucketTest = await this.testBucketAccess()
    const listTest = await this.testListFiles()
    const uploadTest = await this.testUpload()

    console.log('🧪 Storage Test Results:')
    console.log(`  Bucket Access: ${bucketTest ? '✅' : '❌'}`)
    console.log(`  List Files: ${listTest ? '✅' : '❌'}`)
    console.log(`  Upload/Download: ${uploadTest ? '✅' : '❌'}`)

    if (bucketTest && listTest && uploadTest) {
      console.log('🎉 All storage tests passed!')
    } else {
      console.log('⚠️ Some storage tests failed. Check the logs above for details.')
    }
  }
}
